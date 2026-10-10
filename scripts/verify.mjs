import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

function pnpm(...args) {
  return ['pnpm', ...args]
}

function workspace(name, ...args) {
  return pnpm('--filter', name, ...args)
}

// Code Quality workflow의 job과 그 run 명령을 같은 순서로 옮긴다. 의존성 설치는 먼저 끝냈다고 본다.
// scripts/test/code-quality-workflow.test.mjs가 workflow와 이 목록이 어긋나면 실패한다.
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
  { job: 'accounts', commands: [workspace('@dfragon/accounts', 'test')] },
  {
    job: 'ocr',
    commands: [workspace('@dfragon/ocr', 'test'), workspace('@dfragon/ocr', 'test:browser')]
  },
  {
    job: 'web',
    commands: [workspace('@dfragon/web', 'test'), workspace('@dfragon/web', 'build')]
  }
]

// Docker PostgreSQL 컨테이너를 만드는 job이다. Desktop 검색 통합도 실제 API에 붙일 DB를 Docker로 띄운다.
// Docker가 없는 환경에서도 verify를 쓸 수 있게 따로 실행한다.
export const databaseJobs = [
  { job: 'api-database', commands: [workspace('@dfragon/api', 'test:database')] },
  { job: 'accounts-database', commands: [workspace('@dfragon/accounts', 'test:database')] },
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

function formatDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)

  if (minutes === 0) {
    return `${seconds}초`
  }

  return `${minutes}분 ${seconds % 60}초`
}

// CI처럼 job 안의 명령은 앞 명령이 실패하면 멈추고, 다른 job은 계속 실행해 실패한 job을 모두 보고한다.
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
      const result = spawnSync(file, args, { cwd, stdio: 'inherit' })

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

function main(args) {
  const [mode] = args

  if (args.length === 0) {
    return runJobs(checkJobs)
  }

  if (args.length === 1 && mode === '--database') {
    return runJobs(databaseJobs)
  }

  console.error('Usage: node scripts/verify.mjs [--database]')

  return 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
