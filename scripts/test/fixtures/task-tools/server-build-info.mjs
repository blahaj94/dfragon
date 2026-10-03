import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../../server-build-info.mjs', import.meta.url))

export function createServerBuildInfoFixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'dfragon-build-info-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const output = join(folder, 'build-info.json')
  const run = (args, options = {}) => spawnSync(process.execPath, [script, ...args], options)

  return { folder, output, run }
}
