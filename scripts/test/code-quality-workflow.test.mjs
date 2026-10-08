import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createToolingFixture } from './fixtures/code-quality/repository.mjs'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const workflow = await readFile(join(root, '.github/workflows/code-quality.yml'), 'utf8')
const jobs = workflow
  .split(/^jobs:\s*$/mu)[1]
  .split(/(?=^ {2}[\w-]+:\s*$)/mu)
  .filter((job) => /^ {2}[\w-]+:\s*$/mu.test(job))

function jobIdOf(job) {
  return /^ {2}([\w-]+):\s*$/mu.exec(job)[1]
}

function settingsOf(job) {
  return job.split(/^ {4}steps:/mu)[0]
}

function stepsOf(job) {
  return job
    .split(/^ {4}steps:/mu)[1]
    .split(/^ {6}- /mu)
    .slice(1)
}

function runCommandOf(step) {
  const lines = step.split('\n')
  const runLine = lines.findIndex((line) => line.trimStart().startsWith('run:'))
  const runValue = lines[runLine].trimStart().slice('run:'.length).trim()

  if (runValue !== '|' && runValue !== '|-') {
    return runValue
  }

  return lines
    .slice(runLine + 1)
    .filter((line) => line.startsWith('          '))
    .map((line) => line.slice(10))
    .join('\n')
}

const toolingJob = jobs.find((job) => /\bpnpm(?:\s+run)?\s+test:tooling\b/u.test(job))
assert.ok(toolingJob, 'Code Quality가 루트 도구 집계를 호출해야 한다')
const toolingStep = stepsOf(toolingJob).find((step) => {
  return /\bpnpm(?:\s+run)?\s+test:tooling\b/u.test(step)
})
const command = runCommandOf(toolingStep)
// The main ruleset requires this check name, so it must summarize every Code Quality check.
const aggregateJob = jobs.find((job) => jobIdOf(job) === 'lint-and-format')
assert.ok(aggregateJob, 'main ruleset의 required check인 lint-and-format job이 있어야 한다')

const suites = (await readdir(join(root, 'scripts/test'))).filter((name) => {
  return name.endsWith('.test.mjs')
})
// A new suite must be discovered without adding another CI command or editing the aggregate.
suites.push('new-tooling-regression.test.mjs')
suites.sort()

async function runToolingFixture(t, failedSuite) {
  const { directory, trace, env } = await createToolingFixture(t, manifest, suites, failedSuite)
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
}

// The aggregate step uses GitHub's default Linux shell, which runs bash with -e.
async function runAggregate(results) {
  const [step] = stepsOf(aggregateJob)
  const env = { ...process.env, RESULTS: results.join(' ') }

  return run('bash', ['-e', '-c', runCommandOf(step)], { env, timeout: 20_000 })
}

test('Code Quality는 PR과 main push에서 루트 도구 집계를 조건 없이 검사한다', () => {
  const triggers = workflow.split(/^on:\s*$/mu)[1].split(/^\S/mu)[0]

  assert.match(triggers, /^ {2}pull_request:\s*$/mu)
  assert.match(triggers, /^ {2}push:\s*$/mu)
  assert.match(triggers, /^ {4}branches: \[main\]\s*$/mu)
  assert.doesNotMatch(triggers, /\b(?:paths|paths-ignore):/u)
  assert.doesNotMatch(settingsOf(toolingJob), /^ {4}(?:if|continue-on-error):/mu)
  assert.doesNotMatch(toolingStep, /^(?: {8})?(?:if|continue-on-error):/mu)
})

test('lint-and-format은 항상 실행되며 조건 없이 실행되는 모든 job을 기다린다', () => {
  const settings = settingsOf(aggregateJob)
  const needs = /^ {4}needs:\s*\n((?: {6}- [\w-]+\s*\n)+)/mu.exec(settings)
  assert.ok(needs, 'lint-and-format은 기다릴 job을 needs 목록으로 선언해야 한다')
  const checkJobs = jobs.filter((job) => {
    return job !== aggregateJob && !/^ {4}if:/mu.test(settingsOf(job))
  })

  assert.match(settings, /^ {4}if: always\(\)\s*$/mu)
  assert.doesNotMatch(settings, /^ {4}continue-on-error:/mu)
  assert.ok(checkJobs.includes(toolingJob))
  assert.deepEqual(
    [...needs[1].matchAll(/- ([\w-]+)/gu)].map(([, id]) => id).sort(),
    checkJobs.map(jobIdOf).sort()
  )
})

test('lint-and-format은 모든 job이 성공했을 때만 통과한다', async () => {
  await runAggregate(['success', 'success', 'success'])

  for (const result of ['failure', 'cancelled', 'skipped']) {
    await assert.rejects(runAggregate(['success', result, 'success']), { code: 1 }, result)
  }
})

test('실제 CI 명령과 package script는 현재 및 새 루트 도구 테스트를 모두 실행한다', async (t) => {
  await runToolingFixture(t)
})

for (const suite of suites) {
  test(`${suite} 실패는 실제 CI 명령을 non-zero로 종료한다`, async (t) => {
    await runToolingFixture(t, suite)
  })
}
