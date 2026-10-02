import assert from 'node:assert/strict'
import test from 'node:test'
import { managementFixture } from './login-service.fixtures.js'

test('unknown browser actions reject before opening a transaction or changing the request', async () => {
  const fixture = managementFixture()
  const before = { ...fixture.row }
  for (const action of ['unknown', 'constructor', '__proto__', 'end ']) {
    await assert.rejects(fixture.invoke(action), { code: 'LOGIN_REQUEST_INVALID' })
  }
  assert.deepEqual(fixture.row, before)
  assert.deepEqual(fixture.events, [])
})

test('explicit end clears a pending passkey addition after fresh-time checks', async () => {
  const fixture = managementFixture()
  await fixture.invoke('options', { operation: 'add' })
  assert.ok(fixture.row.webauthnChallenge)
  assert.equal(fixture.row.operation, 'add')
  assert.equal(fixture.row.pendingUserId, fixture.row.verifiedUserId)
  const before = { ...fixture.row }
  fixture.events.length = 0

  assert.deepEqual(await fixture.invoke('end'), { ended: true })
  assert.deepEqual(fixture.row, {
    ...before,
    status: 'consumed',
    consumedAt: fixture.now,
    codeChallenge: null,
    launchTicketHash: null,
    browserBindingHash: null,
    qrTicketHash: null,
    phoneBindingHash: null,
    confirmationCode: null,
    webauthnChallenge: null,
    operation: null,
    pendingUserId: null,
    verifiedUserId: null,
    credentialId: null,
    exchangeCodeHash: null,
    codeExpiresAt: null
  })
  assert.deepEqual(fixture.events, [
    'begin',
    'request-lock',
    'time',
    'user-lock',
    'credential-lock',
    'time',
    'time',
    'request-update',
    'commit'
  ])
})

test('removing another key preserves management; removing the current key ends it', async () => {
  for (const current of [false, true]) {
    const fixture = managementFixture()
    const id = fixture.keys[current ? 0 : 1]!.id
    const result = await fixture.invoke('remove', { credentialId: id })
    assert.equal(fixture.keys.length, 1)
    assert.equal(
      fixture.keys.some((key) => key.id === id),
      false
    )
    assert.deepEqual(result, current ? { ended: true } : { managed: true })
    assert.equal(fixture.row.status, current ? 'consumed' : 'managing')
    assert.equal(fixture.events.includes('request-update'), current)
    assert.equal(fixture.events.at(-1), 'commit')
  }
})

test('last-key rejection and classified challenge failure retain their transaction contracts', async () => {
  const last = managementFixture(1)
  await assert.rejects(last.invoke('remove', { credentialId: last.keys[0]!.id }), {
    code: 'LAST_PASSKEY'
  })
  assert.equal(last.row.status, 'managing')
  assert.equal(last.keys.length, 1)
  assert.equal(last.events.includes('request-update'), false)
  assert.equal(last.events.at(-1), 'rollback')

  const failed = managementFixture()
  failed.row.status = 'browser_started'
  failed.row.webauthnChallenge = 'fixture-challenge'
  failed.row.operation = 'authenticate'
  await assert.rejects(failed.invoke('verify', { response: {} }), { code: 'PASSKEY_INVALID' })
  assert.equal(failed.row.webauthnChallenge, null)
  assert.equal(failed.row.operation, null)
  assert.equal(failed.events.at(-1), 'commit')
})
