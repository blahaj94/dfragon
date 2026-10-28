import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runJobs, verify } from '../verify.mjs'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../verify.mjs', import.meta.url))
const stepScript = fileURLToPath(new URL('./fixtures/verify/step.mjs', import.meta.url))

async function runFixtureJobs(t, jobs) {
  const directory = await mkdtemp(join(tmpdir(), 'verify-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const trace = join(directory, 'trace')
  const commandOf = (name, outcome = '0') => [process.execPath, stepScript, trace, name, outcome]
  const fixtureJobs = jobs.map(({ job, steps }) => {
    const commands = steps.map((step) => commandOf(...step))

    return { job, commands }
  })
  const log = t.mock.method(console, 'log', () => {})
  const error = t.mock.method(console, 'error', () => {})
  const code = runJobs(fixtureJobs, directory)
  const ran = (await readFile(trace, 'utf8')).trim().split('\n')
  const output = (mock) => mock.mock.calls.map((call) => call.arguments.join(' ')).join('\n')
  const stdout = output(log)
  const stderr = output(error)
  const commandText = (...step) => commandOf(...step).join(' ')

  return { code, ran, stdout, stderr, commandText }
}

test('모든 명령이 성공하면 job 순서대로 실행하고 0을 반환한다', async (t) => {
  const result = await runFixtureJobs(t, [
    { job: 'static', steps: [['lint'], ['format']] },
    { job: 'tooling', steps: [['tooling']] }
  ])

  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(result.ran, ['lint', 'format', 'tooling'])
  assert.match(result.stdout, /\[verify\] 통과: job 2개, 명령 3개/u)
  assert.equal(result.stderr, '')
})

test('실패한 job의 남은 명령은 건너뛰고 다른 job은 계속 실행한 뒤 실패한 명령을 모두 보고한다', async (t) => {
  const result = await runFixtureJobs(t, [
    { job: 'static', steps: [['lint'], ['format', '3'], ['writing'], ['docs']] },
    { job: 'desktop', steps: [['desktop-test', 'SIGTERM']] },
    { job: 'web', steps: [['web-test']] }
  ])

  assert.equal(result.code, 1)
  assert.deepEqual(result.ran, ['lint', 'format', 'desktop-test', 'web-test'])
  assert.ok(
    result.stderr.includes(
      `  static: ${result.commandText('format', '3')} (exit 3, 이후 명령 2개 미실행)\n`
    ),
    result.stderr
  )
  assert.ok(
    result.stderr.includes(
      `  desktop: ${result.commandText('desktop-test', 'SIGTERM')} (signal SIGTERM)\n`
    ),
    result.stderr
  )
  assert.doesNotMatch(result.stderr, /web-test/u)
  assert.match(result.stderr, /\[verify\] job 3개 중 2개 실패/u)
})

test('실행 파일을 찾지 못한 명령도 실패로 보고한다', (t) => {
  const error = t.mock.method(console, 'error', () => {})
  t.mock.method(console, 'log', () => {})

  const code = runJobs([{ job: 'missing', commands: [['dfragon-verify-missing-command']] }])
  const output = error.mock.calls.map((call) => call.arguments.join(' ')).join('\n')

  assert.equal(code, 1)
  assert.match(output, /missing: dfragon-verify-missing-command \(.*ENOENT/u)
})

test('pnpm script로 시작하면 PATH 대신 실행 중인 pnpm으로 pnpm 명령을 시작한다', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'verify-pnpm-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const trace = join(directory, 'trace')
  const previous = process.env.npm_execpath
  process.env.npm_execpath = join(dirname(stepScript), 'pnpm.mjs')
  t.after(() => {
    if (previous === undefined) {
      delete process.env.npm_execpath
    } else {
      process.env.npm_execpath = previous
    }
  })
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'error', () => {})

  const code = runJobs([
    {
      job: 'static',
      commands: [
        ['pnpm', trace, 'lint', '0'],
        ['pnpm', trace, 'docs', '0']
      ]
    }
  ])

  assert.equal(code, 0)
  assert.deepEqual((await readFile(trace, 'utf8')).trim().split('\n'), ['lint', 'docs'])
})

test('인자를 주면 검사를 실행하지 않고 사용법과 함께 2로 끝난다', async () => {
  await assert.rejects(run('node', [script, '--database']), (error) => {
    assert.equal(error.code, 2)
    assert.match(error.stderr, /Usage: node scripts\/verify\.mjs \[--reuse-pass\]$/mu)
    assert.doesNotMatch(error.stdout, /\[verify\]/u)

    return true
  })
})

async function createVerifyRepository(t) {
  const directory = await mkdtemp(join(tmpdir(), 'verify-reuse-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const repository = join(directory, 'repo')
  const trace = join(directory, 'trace')
  const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' })
  execFileSync('git', ['init', '-q', '-b', 'main', repository])
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  await writeFile(join(repository, 'app.mjs'), 'export const value = 1\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'init')
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'error', () => {})
  const jobsWith = (outcome = '0', traceFile = trace) => [
    { job: 'tooling', commands: [[process.execPath, stepScript, traceFile, 'tooling', outcome]] }
  ]
  const ranCount = async () => {
    try {
      return (await readFile(trace, 'utf8')).trim().split('\n').length
    } catch {
      return 0
    }
  }

  return { repository, git, jobsWith, ranCount }
}

test('통과한 내용과 같은 커밋이면 reusePass로 실행할 때 검사를 건너뛴다', async (t) => {
  const { repository, jobsWith, ranCount } = await createVerifyRepository(t)

  assert.equal(verify(jobsWith(), { cwd: repository }), 0)
  assert.equal(verify(jobsWith(), { cwd: repository, reusePass: true }), 0)
  assert.equal(await ranCount(), 1)
})

test('통과 기록이 있어도 reusePass 없이 실행하면 다시 검사한다', async (t) => {
  const { repository, jobsWith, ranCount } = await createVerifyRepository(t)

  verify(jobsWith(), { cwd: repository })
  verify(jobsWith(), { cwd: repository })

  assert.equal(await ranCount(), 2)
})

test('미커밋 상태로 통과한 내용을 그대로 커밋하면 건너뛴다', async (t) => {
  const { repository, git, jobsWith, ranCount } = await createVerifyRepository(t)
  await writeFile(join(repository, 'app.mjs'), 'export const value = 2\n')
  await writeFile(join(repository, 'next.mjs'), 'export const next = 1\n')

  verify(jobsWith(), { cwd: repository })
  git('add', '-A')
  git('commit', '-q', '-m', 'change')
  verify(jobsWith(), { cwd: repository, reusePass: true })

  assert.equal(await ranCount(), 1)
})

test('작업 트리나 커밋 내용이 통과 기록과 다르면 reusePass여도 검사한다', async (t) => {
  const { repository, git, jobsWith, ranCount } = await createVerifyRepository(t)
  verify(jobsWith(), { cwd: repository })

  await writeFile(join(repository, 'app.mjs'), 'export const value = 2\n')
  verify(jobsWith(), { cwd: repository, reusePass: true })
  assert.equal(await ranCount(), 2)

  await writeFile(join(repository, 'app.mjs'), 'export const value = 3\n')
  git('commit', '-q', '-am', 'change')
  verify(jobsWith(), { cwd: repository, reusePass: true })
  assert.equal(await ranCount(), 3)
})

test('미커밋 상태로 통과했어도 커밋하지 않은 채면 reusePass여도 검사한다', async (t) => {
  const { repository, jobsWith, ranCount } = await createVerifyRepository(t)
  await writeFile(join(repository, 'app.mjs'), 'export const value = 2\n')

  verify(jobsWith(), { cwd: repository })
  verify(jobsWith(), { cwd: repository, reusePass: true })

  assert.equal(await ranCount(), 2)
})

test('실패한 검사는 통과로 기록하지 않는다', async (t) => {
  const { repository, jobsWith, ranCount } = await createVerifyRepository(t)

  assert.equal(verify(jobsWith('3'), { cwd: repository }), 1)
  assert.equal(verify(jobsWith(), { cwd: repository, reusePass: true }), 0)
  assert.equal(await ranCount(), 2)
})

test('검사 중에 작업 트리가 바뀌면 통과로 기록하지 않는다', async (t) => {
  const { repository, jobsWith, ranCount } = await createVerifyRepository(t)
  const traceInRepository = join(repository, 'trace')

  verify(jobsWith('0', traceInRepository), { cwd: repository })
  await rm(traceInRepository)
  verify(jobsWith(), { cwd: repository, reusePass: true })

  assert.equal(await ranCount(), 1)
})
