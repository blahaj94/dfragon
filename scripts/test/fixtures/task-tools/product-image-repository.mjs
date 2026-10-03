import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export function createProductImageRepository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'product-image-plan-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
    GIT_COMMON_DIR: undefined,
    GIT_INDEX_FILE: undefined
  }
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()
  const write = (path, value = path) => {
    const target = join(cwd, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, value)
  }
  const commit = () => {
    git('add', '--all')
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--quiet',
      '--no-gpg-sign',
      '-m',
      'Fixture changes'
    )

    return git('rev-parse', 'HEAD')
  }
  git('init', '--quiet', '--initial-branch=main')
  write('docs/README.md')
  const initial = commit()

  return { cwd, env, git, write, commit, initial }
}
