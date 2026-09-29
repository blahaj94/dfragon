import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createServerBuildInfo } from '../server-build-info.mjs'

const script = fileURLToPath(new URL('../server-build-info.mjs', import.meta.url))
const commit = 'a'.repeat(40)

test('the image builder records each service and the exact selected source commit', () => {
  const folder = mkdtempSync(join(tmpdir(), 'dfragon-build-info-'))
  try {
    const output = join(folder, 'build-info.json')
    for (const service of ['api', 'accounts', 'ocr']) {
      const result = spawnSync(process.execPath, [script, service, commit, output], {
        env: { ...process.env, GITHUB_SHA: 'b'.repeat(40), SOURCE_COMMIT: 'c'.repeat(40) }
      })
      assert.equal(result.status, 0, result.stderr.toString())
      assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), { service, commit })
    }
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

test('local images without a build argument explicitly have no commit information', () => {
  assert.deepEqual(createServerBuildInfo('api', ''), { service: 'api', commit: null })
})

test('invalid source revisions or services fail before replacing existing metadata', () => {
  const folder = mkdtempSync(join(tmpdir(), 'dfragon-build-info-'))
  try {
    const output = join(folder, 'build-info.json')
    const original = JSON.stringify({ service: 'api', commit })
    writeFileSync(output, original)
    for (const [service, invalidCommit] of [
      ['api', 'main'],
      ['api', 'a'.repeat(7)],
      ['api', 'A'.repeat(40)],
      ['api', commit + '\n'],
      ['desktop', commit]
    ]) {
      const result = spawnSync(process.execPath, [script, service, invalidCommit, output])
      assert.notEqual(result.status, 0)
      assert.equal(readFileSync(output, 'utf8'), original)
    }
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})
