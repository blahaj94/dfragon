import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function createAppFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dfragon-create-app-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'scripts'))
  copyFileSync(
    new URL('../../../create-app.mjs', import.meta.url),
    join(root, 'scripts/create-app.mjs')
  )
  const cwd = join(root, 'unrelated directory')
  mkdirSync(cwd)
  const run = (args) =>
    spawnSync(process.execPath, [join(root, 'scripts/create-app.mjs'), ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 10000
    })

  return { root, cwd, run }
}
