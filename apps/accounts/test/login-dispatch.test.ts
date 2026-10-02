import assert from 'node:assert/strict'
import test from 'node:test'
import { managementFixture } from './login-service.fixtures.js'
import { CLEARED_LOGIN_FIELDS } from '../src/constants/login.js'

test('unknown browser actions reject before opening a transaction or changing the request', async () => {
  const fixture = managementFixture()
  const before = { ...fixture.row }
  for (const action of ['unknown', 'constructor', '__proto__', 'end ']) {
    await assert.rejects(fixture.invoke(action), { code: 'LOGIN_REQUEST_INVALID' })
  }
  assert.deepEqual(fixture.row, before)
  assert.deepEqual(fixture.events, [])
})

test('explicit end consumes only the locked management request after fresh-time checks', async () => {
  const fixture = managementFixture()
  assert.deepEqual(await fixture.invoke('end'), { ended: true })
  assert.equal(fixture.row.status, 'consumed')
  assert.equal(fixture.row.consumedAt, fixture.now)
  for (const field of Object.keys(CLEARED_LOGIN_FIELDS) as (keyof typeof CLEARED_LOGIN_FIELDS)[]) {
    assert.equal(fixture.row[field], null)
  }
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
