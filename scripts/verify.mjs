import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

function pnpm(...args) {
  return ['pnpm', ...args]
}

function workspace(name, ...args) {
  return pnpm('--filter', name, ...args)
}

export const checkJobs = [
  {
    job: 'static',
    commands: [pnpm('lint'), pnpm('format:check'), pnpm('check:writing'), pnpm('check:docs')]
  },
  { job: 'tooling', commands: [pnpm('test:tooling')] },
  {
    job: 'packages',
    commands: [
      workspace('@dfragon/licenses', 'test'),
      workspace('@dfragon/lib', 'test'),
      workspace('@dfragon/ui', 'test')
    ]
  },
  {
    job: 'desktop',
    commands: [
      workspace('@dfragon/desktop', 'exec', 'install-electron'),
      workspace('@dfragon/desktop', 'test')
    ]
  },
  { job: 'desktop-typecheck', commands: [workspace('@dfragon/desktop', 'typecheck')] },
  { job: 'api', commands: [workspace('@dfragon/api', 'test')] },
  {
    job: 'desktop-search',
    commands: [
      workspace('@dfragon/desktop', 'exec', 'install-electron'),
      workspace('@dfragon/api', 'build'),
      workspace(
        '@dfragon/desktop',
        'exec',
        'vitest',
        'run',
        '--config',
        'scripts/search-server-integration/vitest.config.ts'
      )
    ]
  }
]

function describeFailure(result) {
  if (result.error) {
    return result.error.message
  }

  if (result.signal) {
    return `signal ${result.signal}`
  }

  return `exit ${result.status}`
}

// Corepack처럼 pnpm을 JavaScript 진입점으로 설치하면 node로 실행해야 한다.
const JAVASCRIPT_ENTRY_PATTERN = /\.[cm]?js$/u

// pnpm script로 시작했으면 그 pnpm을 직접 실행한다. Windows에는 shell 없이 시작할 `pnpm` 실행 파일 없이
// `pnpm.cmd`만 있을 수 있어 git hook에서 `pnpm verify`가 명령을 시작하지 못한다.
function executableOf(file) {
  const pnpmPath = process.env.npm_execpath

  if (file !== 'pnpm' || pnpmPath == null || !basename(pnpmPath).startsWith('pnpm')) {
    return [file]
  }

  if (JAVASCRIPT_ENTRY_PATTERN.test(pnpmPath)) {
    return [process.execPath, pnpmPath]
  }

  return [pnpmPath]
}

function formatDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)

  if (minutes === 0) {
    return `${seconds}초`
  }

  return `${minutes}분 ${seconds % 60}초`
}

// job끼리 같은 build 산출물을 쓰므로 병렬로 실행하지 않는다.
export function runJobs(jobs, cwd = repositoryRoot) {
  const startedAt = Date.now()
  const failures = []
  let commandCount = 0

  for (const { job, commands } of jobs) {
    for (const [index, [file, ...args]] of commands.entries()) {
      const command = [file, ...args].join(' ')
      console.log(`\n[verify] ${job}: ${command}`)
      commandCount += 1
      const [executable, ...prefix] = executableOf(file)
      const result = spawnSync(executable, [...prefix, ...args], { cwd, stdio: 'inherit' })

      if (result.status !== 0) {
        const reason = describeFailure(result)
        const skipped = commands.length - index - 1
        failures.push({ job, command, reason, skipped })
        console.error(`[verify] 실패 ${job}: ${command} (${reason})`)
        break
      }
    }
  }

  const elapsed = formatDuration(Date.now() - startedAt)

  if (failures.length === 0) {
    console.log(`\n[verify] 통과: job ${jobs.length}개, 명령 ${commandCount}개, ${elapsed}`)

    return 0
  }

  console.error(`\n[verify] 실패한 job ${failures.length}개:`)

  for (const failure of failures) {
    let detail = ''

    if (failure.skipped > 0) {
      detail = `, 이후 명령 ${failure.skipped}개 미실행`
    }

    console.error(`  ${failure.job}: ${failure.command} (${failure.reason}${detail})`)
  }

  console.error(`[verify] job ${jobs.length}개 중 ${failures.length}개 실패, ${elapsed}`)

  return 1
}

const REUSE_PASS_FLAG = '--reuse-pass'
const PASS_RECORD_PATH = join('dfragon-verify', 'passed-tree')

function git(cwd, args, env = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } })

  if (result.status !== 0) {
    return null
  }

  return result.stdout.trim()
}

// index 수정 시각이 바뀌면 git이 같은 초에 수정된 파일을 놓치므로 복사본의 시각을 원본과 맞춘다.
function worktreeTree(cwd) {
  const index = git(cwd, ['rev-parse', '--path-format=absolute', '--git-path', 'index'])

  if (index == null) {
    return null
  }

  const directory = mkdtempSync(join(tmpdir(), 'dfragon-verify-'))
  const temporaryIndex = join(directory, 'index')

  try {
    try {
      copyFileSync(index, temporaryIndex)
      const { atime, mtime } = statSync(index)
      utimesSync(temporaryIndex, atime, mtime)
    } catch {
      // 커밋이 없는 저장소처럼 index가 아직 없으면 빈 index에서 시작한다.
    }

    const env = { GIT_INDEX_FILE: temporaryIndex }

    if (git(cwd, ['add', '-A'], env) == null) {
      return null
    }

    return git(cwd, ['write-tree'], env)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function passRecordFile(cwd) {
  const gitDirectory = git(cwd, ['rev-parse', '--absolute-git-dir'])

  if (gitDirectory == null) {
    return null
  }

  return join(gitDirectory, PASS_RECORD_PATH)
}

function readPassedTree(cwd) {
  const file = passRecordFile(cwd)

  if (file == null) {
    return null
  }

  try {
    return readFileSync(file, 'utf8').trim()
  } catch {
    return null
  }
}

function writePassedTree(cwd, tree) {
  const file = passRecordFile(cwd)

  if (file == null) {
    return
  }

  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${tree}\n`)
}

export function verify(jobs, { cwd = repositoryRoot, reusePass = false } = {}) {
  const before = worktreeTree(cwd)

  if (reusePass && before != null) {
    const isCommitted = before === git(cwd, ['rev-parse', 'HEAD^{tree}'])

    if (isCommitted && before === readPassedTree(cwd)) {
      console.log(
        `\n[verify] 같은 내용(tree ${before.slice(0, 12)})을 이미 통과해 검사를 건너뜁니다. 다시 검사하려면 pnpm verify를 실행합니다.`
      )

      return 0
    }
  }

  const code = runJobs(jobs, cwd)

  // 검사 중에 파일이 바뀌었으면 어떤 내용이 통과했는지 특정할 수 없으므로 기록하지 않는다.
  if (code === 0 && before != null && worktreeTree(cwd) === before) {
    writePassedTree(cwd, before)
  }

  return code
}

function main(args) {
  if (args.length === 0) {
    return verify(checkJobs)
  }

  if (args.length === 1 && args[0] === REUSE_PASS_FLAG) {
    return verify(checkJobs, { reusePass: true })
  }

  console.error(`Usage: node scripts/verify.mjs [${REUSE_PASS_FLAG}]`)

  return 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
