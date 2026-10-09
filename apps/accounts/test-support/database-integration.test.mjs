import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanupPrimaryResources } from './database-integration.mjs'

test('DB runner는 단계 실패 뒤 자원 제거도 실패하면 두 원인을 순서대로 보존하고 부재 확인을 건너뛴다', async () => {
  const calls = []
  const stageError = new Error('synthetic-stage-error')
  const cleanupError = new Error('synthetic-cleanup-error')
  await assert.rejects(
    cleanupPrimaryResources({
      resources: {},
      runId: 'synthetic-run',
      runtimeOnly: true,
      stageError,
      teardown: async () => {
        calls.push('teardown')
        throw cleanupError
      },
      assertAbsent: async () => {
        calls.push('assertAbsent')
      }
    }),
    (error) => {
      assert.equal(error instanceof AggregateError, true)
      assert.equal(error.message, 'Database integration and resource cleanup failed')
      assert.equal(error.errors.length, 2)
      assert.equal(error.errors[0], stageError)
      assert.equal(error.errors[1], cleanupError)

      return true
    }
  )
  assert.deepEqual(calls, ['teardown'])
})

test('DB runner는 단계 실패 없이 정리만 실패하면 정리 오류를 그대로 전달한다', async () => {
  const calls = []
  const cleanupError = new Error('synthetic-cleanup-error')
  await assert.rejects(
    cleanupPrimaryResources({
      resources: {},
      runId: 'synthetic-run',
      runtimeOnly: true,
      teardown: async () => {
        calls.push('teardown')
      },
      assertAbsent: async (runId) => {
        calls.push(`assertAbsent ${runId}`)
        throw cleanupError
      }
    }),
    (error) => {
      assert.equal(error, cleanupError)

      return true
    }
  )
  assert.deepEqual(calls, ['teardown', 'assertAbsent synthetic-run'])
})
