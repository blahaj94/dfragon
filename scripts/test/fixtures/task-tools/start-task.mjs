import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../../start-task.mjs', import.meta.url))

export function createStartTaskFixture(t) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'dfragon-start-task-')))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const repository = join(directory, 'repository')
  const origin = join(directory, 'origin.git')
  const destination = join(directory, 'worktree with spaces')
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
  mkdirSync(repository)
  const git = (args, cwd = repository) =>
    execFileSync('git', args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  git(['init', '--initial-branch=main'])
  git(['config', 'user.name', 'Test'])
  git(['config', 'user.email', 'test@example.invalid'])
  git(['config', 'commit.gpgsign', 'false'])
  git(['config', 'core.hooksPath', '/dev/null'])
  writeFileSync(join(repository, 'README.md'), 'initial\n')
  git(['add', 'README.md'])
  git(['commit', '--no-verify', '-m', 'initial'])
  git(['clone', '--bare', repository, origin])
  git(['remote', 'add', 'origin', origin])
  git(['fetch', 'origin', 'main'])
  const calls = []
  const issue = {
    number: 30,
    title: 'Test task',
    url: 'https://example.invalid/issues/30',
    state: 'OPEN'
  }
  const run = (command, args, options) => {
    calls.push([command, ...args])
    const isIssueLookup = command === 'gh'
    if (isIssueLookup) {
      return JSON.stringify(issue)
    }

    return execFileSync(command, args, {
      ...options,
      cwd: repository,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  }

  const cli = (args, overrides = {}) => {
    const bin = join(directory, 'bin')
    const gh = join(bin, 'gh')
    mkdirSync(bin, { recursive: true })
    copyFileSync(fileURLToPath(new URL('../start-task-gh.mjs', import.meta.url)), gh)
    chmodSync(gh, 0o700)

    return spawnSync(process.execPath, [script, ...args], {
      cwd: repository,
      encoding: 'utf8',
      env: {
        ...env,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        START_TASK_ISSUE: JSON.stringify(issue),
        START_TASK_GH_EXIT: '0',
        ...overrides
      }
    })
  }

  return { repository, origin, destination, git, calls, issue, run, cli }
}
