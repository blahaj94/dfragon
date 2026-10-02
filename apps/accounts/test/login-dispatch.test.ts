import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { managementFixture } from './login-service.fixtures.js'
import { configurationFingerprint } from '../src/auth/login/configuration.js'

const TESTS = {
  unknownAction: '알 수 없는 브라우저 action은 transaction 시작과 요청 변경 없이 거절한다',
  exactInput: '관리 action은 정확한 필드와 목적을 요구하고 잘못된 입력으로 권한을 변경하지 않는다',
  originBinding: '관리 Origin은 정확히 일치해야 하며 거절 전에 transaction을 시작하지 않는다',
  cookieBinding:
    '관리 cookie는 요청별 단일 PC proof만 허용하고 거부된 proof는 상태를 바꾸지 않는다',
  configurationBinding: '다른 설정에 묶인 관리 요청은 재사용할 수 없다',
  end: '명시적 종료는 fresh time 검사 뒤 추가 중인 패스키 proof를 모두 지운다',
  removal: '다른 키 삭제는 관리를 유지하고 현재 키 삭제는 관리 권한을 종료한다',
  lastKey: '마지막 현재 RP 키 삭제 거절은 요청과 모든 패스키를 보존한다',
  invalidProof: '잘못된 추가 증명은 challenge만 소비하고 재사용을 거절하며 새 옵션으로 재시도한다',
  retiredCredential: '관리 인증에 쓴 키가 삭제된 뒤에는 기존 관리 권한을 사용할 수 없다',
  expiry: '요청·관리 키·삭제 대상 잠금 뒤 fresh time이 만료 경계면 삭제하지 않는다',
  list: '관리 목록은 본인 계정의 현재 RP 키에 필요한 공개 metadata만 반환한다'
} as const

test(TESTS.unknownAction, async () => {
  const fixture = managementFixture()
  const before = { ...fixture.row }
  for (const action of ['unknown', 'constructor', '__proto__', 'end ']) {
    await assert.rejects(fixture.invoke(action), { code: 'LOGIN_REQUEST_INVALID' })
  }
  assert.deepEqual(fixture.row, before)
  assert.deepEqual(fixture.events, [])
})

test(TESTS.exactInput, async (t) => {
  const cases = [
    {
      name: 'list에 임의 회원 ID 추가',
      action: 'list',
      values: { userId: randomUUID() },
      code: 'INVALID_AUTH_REQUEST'
    },
    {
      name: 'UUID가 아닌 requestId',
      action: 'end',
      values: { requestId: 'bad' },
      code: 'LOGIN_REQUEST_INVALID'
    },
    {
      name: '재인증 없이 새 계정 생성',
      action: 'options',
      values: { operation: 'register' },
      code: 'LOGIN_REQUEST_INVALID'
    },
    {
      name: '관리 중 로그인 옵션',
      action: 'options',
      values: { operation: 'authenticate' },
      code: 'LOGIN_REQUEST_INVALID'
    },
    {
      name: '문자열이 아닌 삭제 대상',
      action: 'remove',
      values: { credentialId: 42 },
      code: 'LOGIN_REQUEST_INVALID'
    }
  ]
  for (const { name, action, values, code } of cases) {
    await t.test(name, async () => {
      const fixture = managementFixture()
      const before = structuredClone({ row: fixture.row, keys: fixture.keys })
      await assert.rejects(fixture.invoke(action, values), { code })
      assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), before)
      assert.equal(fixture.events.includes('request-save'), false)
      assert.equal(fixture.events.includes('request-update'), false)
      assert.equal(fixture.events.includes('credential-delete'), false)
    })
  }
})

test(TESTS.originBinding, async () => {
  const fixture = managementFixture()
  const before = structuredClone({ row: fixture.row, keys: fixture.keys })
  for (const origin of [
    undefined,
    'https://untrusted.invalid',
    fixture.configuration.apiOrigin + '/',
    'https://AUTH.example.test'
  ]) {
    await assert.rejects(
      fixture.service.browser('end', { requestId: fixture.row.id }, fixture.cookie, origin),
      { code: 'LOGIN_REQUEST_INVALID' }
    )
  }
  assert.deepEqual(fixture.events, [])
  assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), before)
})

test(TESTS.cookieBinding, async (t) => {
  const fixture = managementFixture()
  const before = structuredClone({ row: fixture.row, keys: fixture.keys })
  const cookie = fixture.cookie.split(';')[0]!
  const cases = [
    { name: 'cookie 없음', value: '' },
    { name: '다른 요청의 PC cookie', value: managementFixture().cookie },
    {
      name: 'phone cookie로 관리',
      value: cookie.replace('__Host-dfragon-login-', '__Host-dfragon-phone-')
    },
    { name: '같은 요청 cookie 중복', value: `${cookie}; ${cookie}` },
    { name: '정규 형식의 잘못된 proof', value: cookie.replace(/=.*/, '=' + 'A'.repeat(43)) },
    { name: 'padding을 포함한 proof', value: cookie + '=' }
  ]
  for (const { name, value } of cases) {
    await t.test(name, async () => {
      await assert.rejects(fixture.invoke('end', {}, { cookie: value }), {
        code: 'LOGIN_REQUEST_INVALID'
      })
      assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), before)
    })
  }
  assert.equal(fixture.events.includes('user-lock'), false)
  assert.equal(fixture.events.includes('request-update'), false)
  assert.deepEqual(await fixture.invoke('end', {}, { cookie: `unrelated=value; ${cookie}` }), {
    ended: true
  })
})

test(TESTS.configurationBinding, async () => {
  const fixture = managementFixture()
  // 재시작 뒤 바뀐 RP/client 설정으로 만들어진 요청의 fingerprint를 모델링한다.
  fixture.row.configuration = configurationFingerprint({
    ...fixture.configuration,
    returnUrl: 'dfragon.dev://auth/callback'
  })
  const before = structuredClone({ row: fixture.row, keys: fixture.keys })
  await assert.rejects(fixture.invoke('end'), { code: 'LOGIN_REQUEST_INVALID' })
  assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), before)
  assert.equal(fixture.events.includes('user-lock'), false)
  assert.equal(fixture.events.includes('request-update'), false)
  assert.equal(fixture.events.at(-1), 'rollback')
})

test(TESTS.end, async () => {
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
  const ended = structuredClone({ row: fixture.row, keys: fixture.keys })
  for (const action of ['end', 'list']) {
    await assert.rejects(fixture.invoke(action), { code: 'LOGIN_REQUEST_INVALID' })
    assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), ended)
  }
})

test(TESTS.removal, async () => {
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

test(TESTS.lastKey, async () => {
  const last = managementFixture(1)
  last.keys.push({ ...last.keys[0]!, id: 'other-rp-key', rpId: 'previous.example.test' })
  const before = structuredClone({ row: last.row, keys: last.keys })
  await assert.rejects(last.invoke('remove', { credentialId: last.keys[0]!.id }), {
    code: 'LAST_PASSKEY'
  })
  assert.deepEqual(structuredClone({ row: last.row, keys: last.keys }), before)
  assert.equal(last.events.includes('request-update'), false)
  assert.equal(last.events.at(-1), 'rollback')
})

test(TESTS.invalidProof, async () => {
  const failed = managementFixture()
  await failed.invoke('options', { operation: 'add' })
  const before = { ...failed.row }
  const beforeKeys = structuredClone(failed.keys)
  await assert.rejects(failed.invoke('verify', { response: {} }), { code: 'PASSKEY_INVALID' })
  assert.deepEqual(failed.row, {
    ...before,
    webauthnChallenge: null,
    operation: null,
    pendingUserId: null
  })
  assert.deepEqual(structuredClone(failed.keys), beforeKeys)
  assert.equal(failed.events.at(-1), 'commit')

  const afterFailure = { ...failed.row }
  await assert.rejects(failed.invoke('verify', { response: {} }), { code: 'LOGIN_REQUEST_INVALID' })
  assert.deepEqual(failed.row, afterFailure)
  assert.deepEqual(structuredClone(failed.keys), beforeKeys)
  assert.equal(failed.events.at(-1), 'rollback')

  await failed.invoke('options', { operation: 'add' })
  assert.equal(failed.row.status, 'managing')
  assert.equal(failed.row.operation, 'add')
  assert.equal(failed.row.pendingUserId, before.verifiedUserId)
  assert.notEqual(failed.row.webauthnChallenge, before.webauthnChallenge)
  assert.deepEqual(structuredClone(failed.keys), beforeKeys)
})

test(TESTS.retiredCredential, async () => {
  const fixture = managementFixture()
  const retired = fixture.row.credentialId
  fixture.keys.splice(0, 1)
  const before = structuredClone({ row: fixture.row, keys: fixture.keys })
  for (const action of ['list', 'end']) {
    await assert.rejects(fixture.invoke(action), { code: 'PASSKEY_INVALID' })
    assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), before)
    assert.equal(fixture.row.credentialId, retired)
  }
  assert.equal(fixture.events.includes('credential-list'), false)
  assert.equal(fixture.events.includes('request-update'), false)
})

test(TESTS.expiry, async (t) => {
  const cases = [
    { name: 'request 잠금 뒤 이미 만료', credentialLocks: 0 },
    { name: '관리 인증 키 잠금 대기 중 만료', credentialLocks: 1 },
    { name: '삭제 대상 키 잠금 대기 중 만료', credentialLocks: 2 }
  ]
  for (const { name, credentialLocks } of cases) {
    await t.test(name, async () => {
      const fixture = managementFixture()
      let now = credentialLocks === 0 ? fixture.row.expiresAt : fixture.now
      let lockedCredentials = 0
      fixture.state.onClock = () => now
      fixture.state.beforeLockedRead = (kind) => {
        if (kind === 'credential') {
          lockedCredentials++
          if (lockedCredentials === credentialLocks) {
            now = fixture.row.expiresAt
          }
        }
      }
      const before = structuredClone({ row: fixture.row, keys: fixture.keys })
      await assert.rejects(fixture.invoke('remove', { credentialId: fixture.keys[1]!.id }), {
        code: 'LOGIN_REQUEST_INVALID'
      })
      assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), before)
      assert.equal(fixture.events.includes('credential-delete'), false)
      assert.equal(fixture.events.includes('request-update'), false)
      assert.equal(fixture.events.at(-1), 'rollback')
    })
  }
})

test(TESTS.list, async () => {
  const fixture = managementFixture()
  fixture.keys[1]!.lastUsedAt = new Date('2026-10-01T11:59:00Z')
  fixture.keys.push(
    { ...fixture.keys[0]!, id: 'other-rp-key', rpId: 'previous.example.test' },
    { ...fixture.keys[0]!, id: 'other-user-key', userId: randomUUID() }
  )
  const before = structuredClone({ row: fixture.row, keys: fixture.keys })
  assert.deepEqual(await fixture.invoke('list'), {
    keys: [
      {
        id: fixture.keys[0]!.id,
        rpId: 'auth.example.test',
        createdAt: '2026-10-01T12:00:00.000Z',
        lastUsedAt: null,
        current: true
      },
      {
        id: fixture.keys[1]!.id,
        rpId: 'auth.example.test',
        createdAt: '2026-10-01T12:00:00.000Z',
        lastUsedAt: '2026-10-01T11:59:00.000Z',
        current: false
      }
    ]
  })
  assert.deepEqual(structuredClone({ row: fixture.row, keys: fixture.keys }), before)
  assert.equal(fixture.events.at(-1), 'commit')
})
