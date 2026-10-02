import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
const suite = basename(fileURLToPath(import.meta.url))
test('격리된 루트 도구 호출 기록', () => {
  const failed = process.env.ROOT_TOOLING_FAIL === suite
  writeFileSync(join(process.env.ROOT_TOOLING_TRACE, suite), JSON.stringify({ failed }))
  assert.equal(failed, false, '의도한 루트 도구 회귀 실패')
})
