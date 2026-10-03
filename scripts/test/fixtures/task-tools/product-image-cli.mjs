import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../../product-image-plan.mjs', import.meta.url))

export function createProductImageCliFixture(t, cwd) {
  let directory = cwd
  if (directory === undefined) {
    directory = mkdtempSync(join(tmpdir(), 'product-image-output-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
  }
  const eventPath = join(directory, 'event.json')
  const planPath = join(directory, 'plan.json')
  const outputPath = join(directory, 'github-output')
  const run = (args, options = {}) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: directory,
      encoding: 'utf8',
      ...options
    })

  return { cwd: directory, eventPath, planPath, outputPath, run }
}
