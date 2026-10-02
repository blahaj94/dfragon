import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const workflow = await readFile(join(root, '.github/workflows/code-quality.yml'), 'utf8')
const jobs = workflow.split(/^jobs:\s*$/mu)[1].split(/(?=^ {2}[\w-]+:\s*$)/mu)
const toolingJob = jobs.find((job) => /\bpnpm(?:\s+run)?\s+test:tooling\b/u.test(job))
assert.ok(toolingJob, 'Code Quality가 루트 도구 집계를 호출해야 한다')
const steps = toolingJob.split(/^ {6}- /mu).slice(1)
const toolingStep = steps.find((step) => /\bpnpm(?:\s+run)?\s+test:tooling\b/u.test(step))
const runLine = toolingStep.split('\n').findIndex((line) => line.trimStart().startsWith('run:'))
const runValue = toolingStep.split('\n')[runLine].trimStart().slice('run:'.length).trim()
let command = runValue

if (runValue === '|' || runValue === '|-') {
  command = toolingStep
    .split('\n')
    .slice(runLine + 1)
    .filter((line) => line.startsWith('          '))
    .map((line) => line.slice(10))
    .join('\n')
}

const suites = (await readdir(join(root, 'scripts/test'))).filter((name) => {
  return name.endsWith('.test.mjs')
})
// A new suite must be discovered without adding another CI command or editing the aggregate.
suites.push('new-tooling-regression.test.mjs')
suites.sort()

// Replace only the suite boundary, so the real pnpm script and Node discovery run in isolation.
// In particular, the workflow test's copied path contains this probe rather than recursive tests.
const probe = await readFile(new URL('./fixtures/code-quality-suite.mjs', import.meta.url), 'utf8')

async function runToolingFixture(failedSuite) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-code-quality-'))
  const trace = join(directory, 'trace')

  try {
    await mkdir(join(directory, 'scripts/test'), { recursive: true })
    await mkdir(trace)
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        private: true,
        type: 'module',
        packageManager: manifest.packageManager,
        scripts: manifest.scripts
      })
    )

    for (const suite of suites) {
      await writeFile(join(directory, 'scripts/test', suite), probe)
    }

    const failed = failedSuite ?? ''
    const env = { ...process.env, ROOT_TOOLING_TRACE: trace, ROOT_TOOLING_FAIL: failed }
    delete env.NODE_TEST_CONTEXT
    // This job uses GitHub's default Linux shell, which runs bash with -e.
    const execution = run('bash', ['-e', '-c', command], { cwd: directory, env, timeout: 20_000 })

    if (failedSuite == null) {
      await execution
    } else {
      await assert.rejects(execution, { code: 1 })
    }

    assert.deepEqual((await readdir(trace)).sort(), suites, '모든 루트 도구 테스트를 발견해야 한다')

    for (const suite of suites) {
      const failed = suite === failedSuite

      assert.deepEqual(JSON.parse(await readFile(join(trace, suite), 'utf8')), { failed })
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('Code Quality는 PR과 main push에서 루트 도구 집계를 조건 없이 검사한다', () => {
  const triggers = workflow.split(/^on:\s*$/mu)[1].split(/^\S/mu)[0]
  const jobSettings = toolingJob.split(/^ {4}steps:/mu)[0]

  assert.match(triggers, /^ {2}pull_request:\s*$/mu)
  assert.match(triggers, /^ {2}push:\s*$/mu)
  assert.match(triggers, /^ {4}branches: \[main\]\s*$/mu)
  assert.doesNotMatch(triggers, /\b(?:paths|paths-ignore):/u)
  assert.doesNotMatch(jobSettings, /^ {4}(?:if|continue-on-error):/mu)
  assert.doesNotMatch(toolingStep, /^(?: {8})?(?:if|continue-on-error):/mu)
})

test('실제 CI 명령과 package script는 현재 및 새 루트 도구 테스트를 모두 실행한다', async () => {
  await runToolingFixture()
})

for (const suite of suites) {
  test(`${suite} 실패는 실제 CI 명령을 non-zero로 종료한다`, async () => {
    await runToolingFixture(suite)
  })
}
