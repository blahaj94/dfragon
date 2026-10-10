import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runJobs } from '../verify.mjs'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../verify.mjs', import.meta.url))
const stepScript = fileURLToPath(new URL('./fixtures/verify/step.mjs', import.meta.url))

// 각 명령은 실행 순서를 trace 파일에 남기고 지정한 종료 코드나 signal로 끝난다.
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

test('알 수 없는 인자는 검사를 실행하지 않고 사용법과 함께 2로 끝난다', async () => {
  await assert.rejects(run('node', [script, '--unknown']), (error) => {
    assert.equal(error.code, 2)
    assert.match(error.stderr, /Usage: node scripts\/verify\.mjs \[--database\]/u)
    assert.doesNotMatch(error.stdout, /\[verify\]/u)

    return true
  })
})
