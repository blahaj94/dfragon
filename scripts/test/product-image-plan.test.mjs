import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  catchUpPlan,
  createPlan,
  findBaselineRun,
  selectServices,
  validatePlan
} from '../product-image-plan.mjs'

const script = fileURLToPath(new URL('../product-image-plan.mjs', import.meta.url))
const allServices = ['api', 'ocr', 'accounts']

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'product-image-plan-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
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
  git('init', '--quiet')
  write('docs/README.md')
  const initial = commit()
  return { cwd, git, write, commit, initial }
}

test('app directory changes select only their services in canonical order', () => {
  for (const service of allServices) {
    assert.deepEqual(selectServices([`apps/${service}/src/main.ts`]), [service])
  }
  assert.deepEqual(selectServices(['apps/accounts/Dockerfile', 'apps/api/src/main.ts']), [
    'api',
    'accounts'
  ])
})

test('shared build inputs select all consumers with conservative package scopes', () => {
  for (const path of [
    'packages/lib/src/index.ts',
    'packages/licenses/notices/unknown.txt',
    'patches/dependency.patch',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.dockerignore',
    '.npmrc',
    '.github/workflows/product-images.yml',
    '.github/workflows/code-quality.yml',
    'scripts/product-image-plan.mjs',
    'scripts/server-build-info.mjs'
  ]) {
    assert.deepEqual(selectServices([path]), allServices, path)
  }
  assert.deepEqual(selectServices(['packages/ui/src/button.tsx']), ['ocr', 'accounts'])
})

test('docs and unrelated app or tooling changes require no product images', () => {
  assert.deepEqual(
    selectServices([
      'docs/reference/api-start-development.md',
      'README.md',
      'assets/logo.svg',
      'apps/desktop/src/main.ts',
      'apps/web/src/main.tsx',
      'scripts/create-app.mjs'
    ]),
    []
  )
})

test('push planning includes every commit since before, not just the last commit', (t) => {
  const repo = repository(t)
  repo.write('apps/api/src/main.ts')
  repo.commit()
  repo.write('apps/accounts/src/main.ts')
  const sourceCommit = repo.commit()

  const plan = createPlan({
    cwd: repo.cwd,
    eventName: 'push',
    event: { before: repo.initial, after: sourceCommit },
    sourceCommit
  })

  assert.deepEqual(plan, { sourceCommit, services: ['api', 'accounts'] })
})

test('pull request planning includes merge-source changes, deleted and renamed paths', (t) => {
  const repo = repository(t)
  repo.write('apps/api/src/delete me.ts')
  repo.write('apps/ocr/src/rename\nme.ts')
  const base = repo.commit()
  rmSync(join(repo.cwd, 'apps/api/src/delete me.ts'))
  mkdirSync(join(repo.cwd, 'apps/accounts/src'), { recursive: true })
  renameSync(
    join(repo.cwd, 'apps/ocr/src/rename\nme.ts'),
    join(repo.cwd, 'apps/accounts/src/renamed.ts')
  )
  const sourceCommit = repo.commit()

  const plan = createPlan({
    cwd: repo.cwd,
    eventName: 'pull_request',
    event: { pull_request: { base: { sha: base }, head: { sha: repo.initial } } },
    sourceCommit
  })

  assert.deepEqual(plan, { sourceCommit, services: allServices })
})

test('new pushes with a zero before commit build all images', (t) => {
  const repo = repository(t)
  const plan = createPlan({
    cwd: repo.cwd,
    eventName: 'push',
    event: { before: '0'.repeat(40), after: repo.initial },
    sourceCommit: repo.initial
  })
  assert.deepEqual(plan.services, allServices)
})

test('uncertain event ranges fail instead of skipping builds', (t) => {
  const repo = repository(t)
  const defaults = {
    cwd: repo.cwd,
    eventName: 'push',
    event: { before: repo.initial, after: repo.initial },
    sourceCommit: repo.initial
  }

  for (const override of [
    { sourceCommit: 'invalid' },
    { sourceCommit: 'f'.repeat(40) },
    { eventName: 'workflow_run' },
    { event: null },
    { event: { before: repo.initial, after: 'f'.repeat(40) } },
    { event: { before: 'f'.repeat(40), after: repo.initial } },
    { eventName: 'pull_request', event: { pull_request: { base: { sha: 'invalid' } } } }
  ]) {
    assert.throws(() => createPlan({ ...defaults, ...override }))
  }
})

test('plans reject mismatched commits, unknown services, duplicate services and invalid shapes', () => {
  const sourceCommit = 'a'.repeat(40)
  for (const plan of [
    null,
    [],
    { sourceCommit: 'b'.repeat(40), services: ['api'] },
    { sourceCommit: 'invalid', services: ['api'] },
    { sourceCommit, services: 'api' },
    { sourceCommit, services: ['web'] },
    { sourceCommit, services: ['api', 'api'] }
  ]) {
    assert.throws(() => validatePlan(plan, sourceCommit))
  }
})

test('CLI selects from the GitHub event and emits matrix outputs without a Git checkout', (t) => {
  const repo = repository(t)
  repo.write('apps/api/src/main.ts')
  const sourceCommit = repo.commit()
  const eventPath = join(repo.cwd, 'event.json')
  const planPath = join(repo.cwd, 'plan.json')
  const outputPath = join(repo.cwd, 'github-output')
  writeFileSync(eventPath, JSON.stringify({ before: repo.initial, after: sourceCommit }))
  const env = {
    ...process.env,
    GITHUB_EVENT_NAME: 'push',
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_SHA: sourceCommit,
    SOURCE_COMMIT: sourceCommit,
    GITHUB_OUTPUT: outputPath
  }

  const selected = spawnSync(process.execPath, [script, 'select', planPath], {
    cwd: repo.cwd,
    encoding: 'utf8',
    env
  })
  assert.equal(selected.status, 0, selected.stderr)
  assert.deepEqual(JSON.parse(readFileSync(planPath, 'utf8')), { sourceCommit, services: ['api'] })

  const output = spawnSync(process.execPath, [script, 'output', planPath], {
    cwd: tmpdir(),
    encoding: 'utf8',
    env
  })
  assert.equal(output.status, 0, output.stderr)
  assert.equal(readFileSync(outputPath, 'utf8'), 'matrix={"service":["api"]}\nhas_changes=true\n')

  writeFileSync(planPath, JSON.stringify({ sourceCommit, services: [] }))
  const noChanges = spawnSync(process.execPath, [script, 'output', planPath], {
    cwd: tmpdir(),
    encoding: 'utf8',
    env: { ...env, SOURCE_COMMIT: '' }
  })
  assert.equal(noChanges.status, 0, noChanges.stderr)
  assert.equal(
    readFileSync(outputPath, 'utf8'),
    'matrix={"service":["api"]}\nhas_changes=true\nmatrix={"service":[]}\nhas_changes=false\n'
  )
})

test('catch-up recovers canceled accounts changes before a docs-only push', (t) => {
  const repo = repository(t)
  repo.write('apps/accounts/src/main.ts')
  const canceledSource = repo.commit()
  repo.write('docs/README.md', 'Documentation after the canceled push')
  const sourceCommit = repo.commit()
  const plan = createPlan({
    cwd: repo.cwd,
    eventName: 'push',
    event: { before: canceledSource, after: sourceCommit },
    sourceCommit
  })
  assert.deepEqual(plan.services, [])
  const planPath = join(repo.cwd, 'plan.json')
  const baselinePath = join(repo.cwd, 'baseline.json')
  writeFileSync(planPath, JSON.stringify(plan))
  writeFileSync(baselinePath, JSON.stringify({ sourceCommit: repo.initial, services: allServices }))

  const result = spawnSync(process.execPath, [script, 'catch-up', planPath, baselinePath], {
    cwd: repo.cwd,
    encoding: 'utf8',
    env: { ...process.env, SOURCE_COMMIT: sourceCommit }
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(readFileSync(planPath, 'utf8')), {
    sourceCommit,
    services: ['accounts']
  })
})

test('catch-up keeps normal api-only selection and retains the current push services', (t) => {
  const repo = repository(t)
  repo.write('apps/api/src/main.ts')
  const sourceCommit = repo.commit()
  const options = {
    cwd: repo.cwd,
    sourceCommit,
    plan: { sourceCommit, services: ['api'] },
    baselinePlan: { sourceCommit: repo.initial, services: allServices }
  }

  assert.deepEqual(catchUpPlan(options).services, ['api'])
  assert.deepEqual(
    catchUpPlan({ ...options, plan: { sourceCommit, services: ['accounts'] } }).services,
    ['api', 'accounts']
  )
})

test('missing, unavailable, or nonancestor publication baselines require all images', (t) => {
  const repo = repository(t)
  repo.write('apps/api/src/main.ts')
  const sourceCommit = repo.commit()
  repo.git('checkout', '--quiet', '-b', 'other', repo.initial)
  repo.write('apps/accounts/src/main.ts')
  const nonancestor = repo.commit()
  repo.git('checkout', '--quiet', sourceCommit)
  const options = { cwd: repo.cwd, sourceCommit, plan: { sourceCommit, services: ['api'] } }

  for (const baselinePlan of [
    undefined,
    { sourceCommit: 'f'.repeat(40), services: [] },
    { sourceCommit: nonancestor, services: ['accounts'] }
  ]) {
    assert.deepEqual(catchUpPlan({ ...options, baselinePlan }).services, allServices)
  }
  assert.throws(() => catchUpPlan({ ...options, sourceCommit: repo.initial }), /source commit/)
  assert.throws(() => catchUpPlan({ ...options, baselinePlan: { services: [] } }))
})

const successfulRun = { id: 123, event: 'workflow_run', head_branch: 'main', conclusion: 'success' }
const baselineArtifact = { id: 456, name: 'product-image-plan', expired: false }
const apiOptions = {
  apiUrl: 'https://api.github.com',
  repository: 'example/product',
  token: 'synthetic-read-token'
}

function baselineApi(responses, requests = []) {
  return async (url, options) => {
    requests.push({ url, options })
    return { ok: true, json: async () => responses.shift() }
  }
}

test('baseline lookup selects a successful main run with an unexpired plan artifact', async () => {
  const requests = []
  const runId = await findBaselineRun({
    ...apiOptions,
    fetchImpl: baselineApi(
      [{ workflow_runs: [successfulRun] }, { artifacts: [baselineArtifact] }],
      requests
    )
  })

  assert.equal(runId, 123)
  assert.equal(
    requests[0].url,
    'https://api.github.com/repos/example/product/actions/workflows/product-images.yml/runs?branch=main&event=workflow_run&status=success&per_page=1'
  )
  assert.equal(
    requests[1].url,
    'https://api.github.com/repos/example/product/actions/runs/123/artifacts?per_page=100'
  )
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${apiOptions.token}`)
  assert.equal(requests[0].options.redirect, 'error')
})

test('absent successful runs and missing or expired artifacts have no usable baseline', async () => {
  for (const responses of [
    [{ workflow_runs: [] }],
    [{ workflow_runs: [successfulRun] }, { artifacts: [] }],
    [{ workflow_runs: [successfulRun] }, { artifacts: [{ ...baselineArtifact, expired: true }] }]
  ]) {
    assert.equal(await findBaselineRun({ ...apiOptions, fetchImpl: baselineApi(responses) }), null)
  }
})

test('baseline lookup rejects API failures and invalid successful-run identities', async () => {
  for (const responses of [
    [{}],
    [{ workflow_runs: [{ ...successfulRun, id: 0 }] }],
    [{ workflow_runs: [{ ...successfulRun, event: 'pull_request' }] }],
    [{ workflow_runs: [{ ...successfulRun, head_branch: 'other' }] }],
    [{ workflow_runs: [{ ...successfulRun, conclusion: 'failure' }] }],
    [{ workflow_runs: [successfulRun] }, { artifacts: [null] }]
  ]) {
    await assert.rejects(findBaselineRun({ ...apiOptions, fetchImpl: baselineApi(responses) }))
  }
  await assert.rejects(findBaselineRun({ ...apiOptions, fetchImpl: async () => ({ ok: false }) }), {
    message: 'Could not read the successful product image baseline from GitHub'
  })
  await assert.rejects(
    findBaselineRun({
      ...apiOptions,
      fetchImpl: async () => {
        throw new Error(`Request failed with ${apiOptions.token}`)
      }
    }),
    { message: 'Could not read the successful product image baseline from GitHub' }
  )
})
