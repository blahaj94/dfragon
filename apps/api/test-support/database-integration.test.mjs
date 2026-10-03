import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanupDatabaseIntegration } from './database-integration.mjs'

test('DB runner는 연결 정리가 실패해도 전용 자원 제거와 부재 확인을 계속한다', async (t) => {
  for (const [failure, description] of [
    ['source', '연결 종료'],
    ['teardown', '자원 제거'],
    ['assertAbsent', '자원 부재 확인']
  ]) {
    await t.test(`${description} 실패`, async () => {
      const calls = []
      const operation = (name) => async () => {
        calls.push(name)
        if (name === failure) {
          throw new Error('synthetic-private-cleanup-error')
        }
      }
      await assert.rejects(
        cleanupDatabaseIntegration({
          source: { isInitialized: true, destroy: operation('source') },
          resources: {},
          id: 'synthetic-run',
          teardown: operation('teardown'),
          assertAbsent: operation('assertAbsent')
        }),
        new Error('API database test resource cleanup failed')
      )
      assert.deepEqual(calls, ['source', 'teardown', 'assertAbsent'])
    })
  }
})

test('DB runner는 생성 전 실패에서도 정리 식별자의 자원 부재를 확인한다', async () => {
  let absentId
  await cleanupDatabaseIntegration({
    source: { isInitialized: false, destroy: async () => assert.fail('연결하지 않은 source') },
    id: 'synthetic-before-creation',
    teardown: async () => assert.fail('생성하지 않은 자원'),
    assertAbsent: async (id) => {
      absentId = id
    }
  })
  assert.equal(absentId, 'synthetic-before-creation')
})
