import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkedAt, cleanupFixture, request, session } from './cleanup-fixtures.mjs'

const load = () => import('../dist/auth/cleanup/index.js')
const cases = {
  session: 'cleanup의 session 삭제 경계',
  request: 'cleanup의 패스키 요청 삭제 경계',
  reread: 'cleanup은 후보 이후 활동·소유 변경·삭제를 잠금 아래 다시 확인한다',
  requestReread: 'cleanup은 후보 이후 패스키 요청의 존재·terminal 상태를 다시 확인한다',
  empty: '빈 cleanup은 호출자 DataSource의 연결 수명을 소유하지 않는다',
  partialFailure: '나중 transaction 실패는 앞서 확인한 삭제 commit을 되돌렸다고 보고하지 않는다',
  uncertain: '삭제 commit 응답 유실은 데이터가 삭제됐어도 실패로 정제한다'
}

for (const [name, patch, shouldDelete] of [
  ['활성 session', {}, false],
  ['idle 만료 1초 전', { lastActiveAt: new Date('2026-08-09T00:00:01.000Z') }, false],
  ['정확한 idle 만료', { lastActiveAt: new Date('2026-08-09T00:00:00.000Z') }, true],
  ['idle 만료 1초 후', { lastActiveAt: new Date('2026-08-08T23:59:59.000Z') }, true],
  ['logout으로 폐기', { revokedAt: checkedAt, revokedReason: 'logout' }, true],
  ['refresh 재사용으로 폐기', { revokedAt: checkedAt, revokedReason: 'refresh_reuse' }, true]
]) {
  test(`${cases.session}: ${name}`, async () => {
    const { cleanupAuthentication } = await load()
    const row = session(patch)
    const f = cleanupFixture({ sessions: [row] })
    const result = await cleanupAuthentication(f.source)
    const expectedIds = shouldDelete ? [row.id] : []
    assert.deepEqual(result, { sessionsDeleted: expectedIds.length, loginRequestsDeleted: 0 })
    assert.deepEqual(f.deleted, { sessions: expectedIds, requests: [] })
    assert.deepEqual(f.events, ['lock', 'fresh-time', 'commit'])
  })
}

for (const [name, patch, shouldDelete] of [
  ['유효한 browser_started', {}, false],
  ['유효한 created', { status: 'created' }, false],
  ['유효한 managing', { status: 'managing' }, false],
  ['전체 TTL 만료 1초 전', { expiresAt: new Date(checkedAt.getTime() + 1000) }, false],
  ['정확한 전체 TTL 만료', { expiresAt: checkedAt }, true],
  ['전체 TTL 만료 1초 후', { expiresAt: new Date(checkedAt.getTime() - 1000) }, true],
  ['consumed의 정리', { status: 'consumed' }, true],
  ['failed의 정리', { status: 'failed' }, true],
  [
    '유효한 exchange_ready',
    { status: 'exchange_ready', codeExpiresAt: new Date(checkedAt.getTime() + 1000) },
    false
  ],
  [
    '교환 code만 만료되고 전체 TTL은 유효',
    { status: 'exchange_ready', codeExpiresAt: checkedAt },
    false
  ]
]) {
  test(`${cases.request}: ${name}`, async () => {
    const { cleanupAuthentication } = await load()
    const row = request(patch)
    const f = cleanupFixture({ requests: [row] })
    const result = await cleanupAuthentication(f.source)
    const expectedIds = shouldDelete ? [row.id] : []
    assert.deepEqual(result, { sessionsDeleted: 0, loginRequestsDeleted: expectedIds.length })
    assert.deepEqual(f.deleted, { sessions: [], requests: expectedIds })
    assert.deepEqual(f.events, ['lock', 'fresh-time', 'commit'])
  })
}

test(cases.reread, async (t) => {
  const { cleanupAuthentication } = await load()
  for (const [name, change] of [
    ['활동이 먼저 commit되어 deadline 연장', 'activity'],
    ['존재하는 다른 회원으로 소유 변경', 'ownership'],
    ['다른 transaction에서 session 삭제', 'removed']
  ]) {
    await t.test(name, async () => {
      const row = session({ lastActiveAt: new Date('2026-08-09T00:00:00.000Z') })
      const other = session()
      const rows = [row, other]
      const f = cleanupFixture({
        sessions: rows,
        beforeLock: (currentRows, id) => {
          if (id !== row.id) {
            return
          }

          if (change === 'activity') {
            row.lastActiveAt = checkedAt
          } else if (change === 'ownership') {
            row.userId = other.userId
          } else {
            currentRows.splice(currentRows.indexOf(row), 1)
          }
        }
      })
      assert.deepEqual(await cleanupAuthentication(f.source), {
        sessionsDeleted: 0,
        loginRequestsDeleted: 0
      })
      assert.deepEqual(f.deleted, { sessions: [], requests: [] })
      assert.equal(other.revokedAt, null)
      assert.equal(other.lastActiveAt, checkedAt)
    })
  }
})

test(cases.requestReread, async (t) => {
  const { cleanupAuthentication } = await load()
  for (const [name, change, shouldDelete] of [
    ['후보 조회 뒤 현재 row 삭제', 'removed', false],
    ['유효한 browser_started가 failed로 전이', 'failed', true]
  ]) {
    await t.test(name, async () => {
      const row = request()
      const f = cleanupFixture({
        requests: [row],
        beforeLock: (rows) => {
          if (change === 'removed') {
            rows.splice(rows.indexOf(row), 1)
          } else {
            const terminal = request({ id: row.id, status: 'failed' })
            Object.assign(row, terminal)
          }
        }
      })
      const expectedIds = shouldDelete ? [row.id] : []
      assert.deepEqual(await cleanupAuthentication(f.source), {
        sessionsDeleted: 0,
        loginRequestsDeleted: expectedIds.length
      })
      assert.deepEqual(f.deleted, { sessions: [], requests: expectedIds })
    })
  }
})

test(cases.empty, async () => {
  const { cleanupAuthentication } = await load()
  const f = cleanupFixture()
  f.source.initialize = () => assert.fail('호출자의 연결을 초기화할 수 없음')
  f.source.destroy = () => assert.fail('호출자의 연결을 종료할 수 없음')
  assert.deepEqual(await cleanupAuthentication(f.source), {
    sessionsDeleted: 0,
    loginRequestsDeleted: 0
  })
  assert.deepEqual(await cleanupAuthentication(f.source), {
    sessionsDeleted: 0,
    loginRequestsDeleted: 0
  })
  assert.deepEqual(f.events, [])
})

test(cases.partialFailure, async () => {
  const { cleanupAuthentication } = await load()
  const first = session({ revokedAt: checkedAt, revokedReason: 'logout' })
  const second = session({ revokedAt: checkedAt, revokedReason: 'logout' })
  const f = cleanupFixture({
    sessions: [first, second],
    beforeCommit: (number) => {
      if (number === 2) {
        throw new Error('fixture-private SQL detail')
      }
    }
  })
  await assert.rejects(cleanupAuthentication(f.source), (error) => {
    assert.equal(error.message, 'Authentication cleanup failed')
    assert.equal(error.stack, 'Error: Authentication cleanup failed')
    assert.equal(error.cause, undefined)

    return true
  })
  assert.deepEqual(f.deleted, { sessions: [first.id], requests: [] })
})

test(cases.uncertain, async () => {
  const { cleanupAuthentication } = await load()
  const row = session({ revokedAt: checkedAt, revokedReason: 'logout' })
  const f = cleanupFixture({
    sessions: [row],
    afterCommit: () => {
      throw new Error('fixture-private commit response lost')
    }
  })
  await assert.rejects(cleanupAuthentication(f.source), (error) => {
    assert.equal(error.message, 'Authentication cleanup failed')
    assert.equal(error.stack, 'Error: Authentication cleanup failed')
    assert.equal(error.cause, undefined)

    return true
  })
  assert.deepEqual(f.deleted, { sessions: [row.id], requests: [] })
})
