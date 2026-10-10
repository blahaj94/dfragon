import assert from 'node:assert/strict'
import test from 'node:test'
import { managementFixture, registrationResponse } from './login-service.fixtures.js'

const TESTS = {
  optionsLimit: '현재 RP의 19개 키는 추가 옵션을 허용하고 20개 키는 무변경 거절한다',
  verifyLimit: '추가 옵션 발급 뒤 현재 RP 키가 20개에 도달하면 최종 검증에서 재검사한다',
  registration: '19개 키에서 검증한 패스키는 20번째 키를 저장하고 challenge를 소비한다',
  replacedChallenge:
    '재발급으로 대체된 challenge의 등록 증명은 소비, 거절하고 새 옵션으로 재시도한다',
  verificationBoundary: '잘못된 origin, RP, UV 등록 증명은 키를 만들지 않고 challenge를 소비한다'
} as const

test(TESTS.optionsLimit, async () => {
  const available = managementFixture(19)
  available.keys.push({ ...available.keys[0]!, id: 'other-rp-key', rpId: 'previous.example.test' })
  await available.invoke('options', { operation: 'add' })
  assert.equal(available.row.operation, 'add')
  assert.equal(typeof available.row.webauthnChallenge, 'string')
  assert.equal(available.events.at(-1), 'commit')

  const full = managementFixture(20)
  const before = structuredClone({ row: full.row, keys: full.keys })
  await assert.rejects(full.invoke('options', { operation: 'add' }), { code: 'PASSKEY_LIMIT' })
  assert.deepEqual(structuredClone({ row: full.row, keys: full.keys }), before)
  assert.equal(full.events.includes('request-save'), false)
  assert.equal(full.events.includes('request-update'), false)
  assert.equal(full.events.at(-1), 'rollback')
})

test(TESTS.verifyLimit, async () => {
  const fixture = managementFixture(19)
  await fixture.invoke('options', { operation: 'add' })
  fixture.keys.push({ ...fixture.keys[0]!, id: 'concurrent-registration' })
  fixture.events.length = 0
  const before = structuredClone({ row: fixture.row, keys: fixture.keys })

  await assert.rejects(fixture.invoke('verify', { response: {} }), { code: 'PASSKEY_LIMIT' })
  assert.deepEqual(fixture.events, [
    'begin',
    'request-lock',
    'time',
    'user-lock',
    'credential-lock',
    'time',
    'credential-count',
    'rollback'
  ])
  assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), before)
})

test(TESTS.registration, async () => {
  const fixture = managementFixture(19)
  await fixture.invoke('options', { operation: 'add' })
  const before = { ...fixture.row }
  const response = registrationResponse(fixture)

  assert.deepEqual(await fixture.invoke('verify', { response }), { managed: true })
  assert.equal(fixture.keys.length, 20)
  assert.equal(fixture.keys.at(-1)!.id, response.id)
  assert.equal(fixture.keys.at(-1)!.userId, before.verifiedUserId)
  assert.equal(fixture.keys.at(-1)!.rpId, 'auth.example.test')
  assert.deepEqual(fixture.row, {
    ...before,
    webauthnChallenge: null,
    operation: null,
    pendingUserId: null
  })
  assert.equal(fixture.events.at(-1), 'commit')
  const afterSuccess = structuredClone({ row: fixture.row, keys: fixture.keys })
  await assert.rejects(fixture.invoke('verify', { response }), { code: 'LOGIN_REQUEST_INVALID' })
  assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), afterSuccess)
})

test(TESTS.replacedChallenge, async () => {
  const fixture = managementFixture()
  await fixture.invoke('options', { operation: 'add' })
  const oldProof = registrationResponse(fixture)
  const oldChallenge = fixture.row.webauthnChallenge
  await fixture.invoke('options', { operation: 'add' })
  assert.notEqual(fixture.row.webauthnChallenge, oldChallenge)
  const before = { ...fixture.row }
  const beforeKeys = structuredClone(fixture.keys)

  await assert.rejects(fixture.invoke('verify', { response: oldProof }), {
    code: 'PASSKEY_INVALID'
  })
  assert.deepEqual(fixture.row, {
    ...before,
    webauthnChallenge: null,
    operation: null,
    pendingUserId: null
  })
  assert.deepEqual(structuredClone(fixture.keys), beforeKeys)
  assert.equal(fixture.events.at(-1), 'commit')

  await fixture.invoke('options', { operation: 'add' })
  const currentProof = registrationResponse(fixture)
  assert.deepEqual(await fixture.invoke('verify', { response: currentProof }), { managed: true })
  assert.equal(fixture.keys.length, 3)
  assert.equal(fixture.keys.at(-1)!.id, currentProof.id)
  assert.equal(
    fixture.keys.some((key) => key.id === oldProof.id),
    false
  )
})

test(TESTS.verificationBoundary, async (t) => {
  const cases = [
    { name: '다른 origin', values: { origin: 'https://untrusted.invalid' } },
    { name: '다른 RP hash', values: { rpId: 'other.example.test' } },
    { name: '사용자 검증 UV 없음', values: { flags: 0x41 } }
  ]
  for (const { name, values } of cases) {
    await t.test(name, async () => {
      const fixture = managementFixture()
      await fixture.invoke('options', { operation: 'add' })
      const response = registrationResponse(fixture, values)
      const before = { ...fixture.row }
      const beforeKeys = structuredClone(fixture.keys)
      await assert.rejects(fixture.invoke('verify', { response }), { code: 'PASSKEY_INVALID' })
      assert.deepEqual(fixture.row, {
        ...before,
        webauthnChallenge: null,
        operation: null,
        pendingUserId: null
      })
      assert.deepEqual(structuredClone(fixture.keys), beforeKeys)
      assert.equal(fixture.events.includes('credential-insert'), false)
      assert.equal(fixture.events.at(-1), 'commit')
    })
  }
})
