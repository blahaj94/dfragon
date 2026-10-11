import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { isoCBOR } from '@simplewebauthn/server/helpers'
import { managementFixture, registrationResponse } from './login-service.fixtures.js'

function registrationFixture(operation: 'register' | 'add') {
  const fixture = managementFixture()
  if (operation === 'register') {
    fixture.row.purpose = 'login'
    fixture.row.status = 'browser_started'
    fixture.row.returnUrl = 'http://127.0.0.1:49152/auth/callback'
    fixture.row.verifiedUserId = null
    fixture.row.credentialId = null
  }

  return fixture
}

test('가입, 추가 등록 옵션은 경고 없이 EdDSA, ES256, RS256 순서로만 제공한다', async (t) => {
  const warnings: Error[] = []
  const onWarning = (warning: Error) => warnings.push(warning)
  process.on('warning', onWarning)
  try {
    for (const operation of ['register', 'add'] as const) {
      await t.test(operation, async () => {
        const fixture = registrationFixture(operation)
        const options = await fixture.invoke('options', { operation })
        assert.ok(options != null && typeof options === 'object' && 'pubKeyCredParams' in options)
        assert.deepEqual(options.pubKeyCredParams, [
          { alg: -8, type: 'public-key' },
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' }
        ])
      })
    }
    // warning 이벤트는 다음 tick에 전달되므로 고정 시간 대기 없이 큐를 비운다.
    await setImmediate()
    assert.deepEqual(warnings, [])
  } finally {
    process.off('warning', onWarning)
  }
})

test('ML-DSA-44 등록은 회원, 키를 저장하지 않고 challenge를 소비하며 거절한다', async (t) => {
  const { publicKey } = generateKeyPairSync('ml-dsa-44')
  const credentialPublicKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 7],
      [3, -48],
      [-1, publicKey.export({ format: 'raw-public' })]
    ])
  )
  for (const operation of ['register', 'add'] as const) {
    await t.test(operation, async () => {
      const fixture = registrationFixture(operation)
      await fixture.invoke('options', { operation })
      const response = registrationResponse(fixture, { credentialPublicKey })
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
      assert.equal(fixture.events.includes('user-insert'), false)
      assert.equal(fixture.events.includes('credential-insert'), false)
      assert.equal(fixture.events.at(-1), 'commit')
    })
  }
})

test('등록 응답의 transports를 저장하고 다음 추가 옵션의 excludeCredentials에 전달한다', async () => {
  const fixture = managementFixture()
  await fixture.invoke('options', { operation: 'add' })
  const response = registrationResponse(fixture)
  response.response.transports = ['internal', 'hybrid']

  assert.deepEqual(await fixture.invoke('verify', { response }), { managed: true })
  assert.deepEqual(fixture.keys.at(-1)!.transports, ['internal', 'hybrid'])
  const options = await fixture.invoke('options', { operation: 'add' })
  assert.ok(options != null && typeof options === 'object' && 'excludeCredentials' in options)
  assert.deepEqual(options.excludeCredentials, [
    { id: fixture.keys[0]!.id, type: 'public-key', transports: [] },
    { id: fixture.keys[1]!.id, type: 'public-key', transports: [] },
    { id: response.id, type: 'public-key', transports: ['internal', 'hybrid'] }
  ])
})
