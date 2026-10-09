import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  catchUpPlan,
  createPlan,
  findBaselineRun,
  selectServices,
  validatePlan
} from '../product-image-plan.mjs'
import { createProductImageApiFixture } from './fixtures/task-tools/product-image-api.mjs'
import { createProductImageCliFixture } from './fixtures/task-tools/product-image-cli.mjs'
import { createProductImageRepository as repository } from './fixtures/task-tools/product-image-repository.mjs'

const allServices = ['api', 'ocr', 'accounts']

test('앱별 경로는 해당 서비스만 선택하고 여러 서비스는 정해진 순서로 정렬한다', () => {
  for (const service of allServices) {
    assert.deepEqual(selectServices([`apps/${service}/src/main.ts`]), [service])
  }
  assert.deepEqual(selectServices(['apps/accounts/Dockerfile', 'apps/api/src/main.ts']), [
    'api',
    'accounts'
  ])
})

test('공용 빌드 입력은 모든 서비스를 선택하고 UI 변경은 두 소비자만 선택한다', () => {
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

test('문서, 무관한 앱, 다른 tooling과 비슷한 접두사의 경로는 이미지를 선택하지 않는다', () => {
  assert.deepEqual(
    selectServices([
      'docs/reference/api-start-development.md',
      'README.md',
      'assets/logo.svg',
      'apps/desktop/src/main.ts',
      'apps/web/src/main.tsx',
      'scripts/create-app.mjs',
      'apps/api-copy/src/main.ts',
      'apps/ocr-extra/src/main.ts',
      'packages/library/src/main.ts',
      'packages/ui-kit/src/button.tsx',
      'docs/apps/accounts/src/main.ts'
    ]),
    []
  )
})

test('push 계획은 마지막 commit뿐 아니라 before 이후의 모든 commit을 포함한다', (t) => {
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

test('PR 계획은 head payload 대신 checkout source의 삭제, 이름 변경 경로를 포함한다', (t) => {
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

test('before가 zero SHA인 새 push는 모든 이미지를 선택한다', (t) => {
  const repo = repository(t)
  const plan = createPlan({
    cwd: repo.cwd,
    eventName: 'push',
    event: { before: '0'.repeat(40), after: repo.initial },
    sourceCommit: repo.initial
  })
  assert.deepEqual(plan.services, allServices)
})

test('불명확한 event 범위와 source commit은 빈 계획 대신 실패 처리한다', (t) => {
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

test('계획은 미커밋 변경을 포함하지 않고 실제 checkout과 다른 기존 commit을 거절한다', (t) => {
  const repo = repository(t)
  repo.write('docs/README.md', 'Committed documentation only\n')
  const sourceCommit = repo.commit()
  repo.write('apps/api/src/main.ts', 'Staged server change\n')
  repo.git('add', 'apps/api/src/main.ts')
  repo.write('apps/ocr/src/local.ts', 'Untracked server change\n')
  const statusBefore = repo.git('status', '--porcelain')
  const options = {
    cwd: repo.cwd,
    eventName: 'push',
    event: { before: repo.initial, after: sourceCommit },
    sourceCommit
  }

  assert.deepEqual(createPlan(options), { sourceCommit, services: [] })
  assert.throws(() => createPlan({ ...options, sourceCommit: repo.initial }), {
    message: 'Git HEAD does not match the product image source commit'
  })
  assert.equal(repo.git('rev-parse', 'HEAD'), sourceCommit)
  assert.equal(repo.git('status', '--porcelain'), statusBefore)
  assert.equal(
    readFileSync(join(repo.cwd, 'apps/api/src/main.ts'), 'utf8'),
    'Staged server change\n'
  )
  assert.equal(
    readFileSync(join(repo.cwd, 'apps/ocr/src/local.ts'), 'utf8'),
    'Untracked server change\n'
  )
})

test('계획은 commit 불일치, 알 수 없는 서비스, 중복, 잘못된 구조를 거절한다', () => {
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

test('CLI는 GitHub event로 계획을 저장하고 Git checkout 없이 matrix, 빈 목록을 출력한다', (t) => {
  const repo = repository(t)
  repo.write('apps/api/src/main.ts')
  const sourceCommit = repo.commit()
  const { eventPath, planPath, outputPath, run } = createProductImageCliFixture(t, repo.cwd)
  writeFileSync(eventPath, JSON.stringify({ before: repo.initial, after: sourceCommit }))
  const env = {
    ...repo.env,
    GITHUB_EVENT_NAME: 'push',
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_SHA: sourceCommit,
    SOURCE_COMMIT: sourceCommit,
    GITHUB_OUTPUT: outputPath
  }

  const selected = run(['select', planPath], { env })
  assert.equal(selected.status, 0, selected.stderr)
  assert.deepEqual(JSON.parse(readFileSync(planPath, 'utf8')), { sourceCommit, services: ['api'] })

  const output = run(['output', planPath], {
    cwd: tmpdir(),
    env
  })
  assert.equal(output.status, 0, output.stderr)
  assert.equal(readFileSync(outputPath, 'utf8'), 'matrix={"service":["api"]}\nhas_changes=true\n')

  writeFileSync(planPath, JSON.stringify({ sourceCommit, services: [] }))
  const noChanges = run(['output', planPath], {
    cwd: tmpdir(),
    env: { ...env, SOURCE_COMMIT: '' }
  })
  assert.equal(noChanges.status, 0, noChanges.stderr)
  assert.equal(
    readFileSync(outputPath, 'utf8'),
    'matrix={"service":["api"]}\nhas_changes=true\nmatrix={"service":[]}\nhas_changes=false\n'
  )
})

test('CLI select의 입력, revision, 사용법 오류는 기존 plan과 GitHub 출력 파일을 보존한다', (t) => {
  const repo = repository(t)
  const { eventPath, planPath, outputPath, run } = createProductImageCliFixture(t, repo.cwd)
  const eventBody = JSON.stringify({ before: repo.initial, after: repo.initial })
  writeFileSync(planPath, 'existing plan\n')
  writeFileSync(outputPath, 'existing output\n')

  for (const options of [
    { eventName: 'workflow_run', error: 'Expected a push or pull_request event' },
    { eventBody: '{invalid JSON', error: 'Could not read GitHub event JSON' },
    { eventPath: join(repo.cwd, 'missing-event.json'), error: 'Could not read GitHub event JSON' },
    {
      sourceCommit: 'f'.repeat(40),
      error: 'Git HEAD does not match the product image source commit'
    },
    {
      args: ['select', planPath, 'unexpected'],
      error:
        'Usage: product-image-plan.mjs baseline | <select|output> <plan-file> | catch-up <plan-file> [baseline-plan-file]'
    }
  ]) {
    writeFileSync(eventPath, options.eventBody ?? eventBody)
    const result = run(options.args ?? ['select', planPath], {
      env: {
        ...repo.env,
        GITHUB_EVENT_NAME: options.eventName ?? 'push',
        GITHUB_EVENT_PATH: options.eventPath ?? eventPath,
        SOURCE_COMMIT: options.sourceCommit ?? repo.initial,
        GITHUB_SHA: repo.initial,
        GITHUB_OUTPUT: outputPath
      }
    })

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, `${options.error}\n`)
    assert.equal(readFileSync(planPath, 'utf8'), 'existing plan\n')
    assert.equal(readFileSync(outputPath, 'utf8'), 'existing output\n')
    assert.equal(repo.git('rev-parse', 'HEAD'), repo.initial)
  }
})

test('CLI output은 SOURCE_COMMIT을 우선하고 서비스 순서를 정렬해 기존 출력에 추가한다', (t) => {
  const { planPath, outputPath, run } = createProductImageCliFixture(t)
  const sourceCommit = 'a'.repeat(40)
  const planBody = JSON.stringify({ sourceCommit, services: ['accounts', 'api', 'ocr'] })
  writeFileSync(planPath, planBody)
  writeFileSync(outputPath, 'existing output\n')

  const result = run(['output', planPath], {
    env: {
      ...process.env,
      SOURCE_COMMIT: sourceCommit,
      GITHUB_SHA: 'b'.repeat(40),
      GITHUB_OUTPUT: outputPath
    }
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.equal(
    readFileSync(outputPath, 'utf8'),
    'existing output\nmatrix={"service":["api","ocr","accounts"]}\nhas_changes=true\n'
  )
  assert.equal(readFileSync(planPath, 'utf8'), planBody)
})

test('CLI output의 읽기, 검증, 쓰기 실패는 기존 matrix를 변경하거나 성공으로 처리하지 않는다', (t) => {
  const { cwd, planPath, outputPath, run } = createProductImageCliFixture(t)
  const sourceCommit = 'a'.repeat(40)
  const directoryOutput = join(cwd, 'output-directory')
  const absentPlan = join(cwd, 'missing-plan.json')
  const planBody = JSON.stringify({ sourceCommit, services: ['api'] })
  mkdirSync(directoryOutput)
  writeFileSync(join(directoryOutput, 'keep.txt'), 'keep output directory\n')
  writeFileSync(outputPath, 'existing output\n')

  for (const options of [
    { planPath: absentPlan, error: 'Could not read product image plan JSON' },
    { planBody: '{invalid JSON', error: 'Could not read product image plan JSON' },
    {
      planBody: JSON.stringify({ sourceCommit: 'b'.repeat(40), services: ['api'] }),
      error: 'Plan source commit does not match the product image source commit'
    },
    {
      planBody: JSON.stringify({ sourceCommit, services: ['api', 'api'] }),
      error: 'Expected a plan with unique api, ocr, or accounts services'
    },
    { outputPath: '', error: 'Expected GITHUB_OUTPUT for product image planning' },
    { outputPath: directoryOutput, error: 'Could not write the product image planning output' }
  ]) {
    const input = options.planBody ?? planBody
    writeFileSync(planPath, input)
    const result = run(['output', options.planPath ?? planPath], {
      env: {
        ...process.env,
        SOURCE_COMMIT: sourceCommit,
        GITHUB_SHA: sourceCommit,
        GITHUB_OUTPUT: options.outputPath ?? outputPath
      }
    })

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, `${options.error}\n`)
    assert.equal(readFileSync(outputPath, 'utf8'), 'existing output\n')
    assert.equal(readFileSync(planPath, 'utf8'), input)
    assert.equal(readFileSync(join(directoryOutput, 'keep.txt'), 'utf8'), 'keep output directory\n')
    assert.equal(existsSync(absentPlan), false)
  }
})

test('catch-up은 취소된 accounts 변경을 문서만 바뀐 다음 push 계획에 복구한다', (t) => {
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
  const { planPath, run } = createProductImageCliFixture(t, repo.cwd)
  const baselinePath = join(repo.cwd, 'baseline.json')
  writeFileSync(planPath, JSON.stringify(plan))
  writeFileSync(baselinePath, JSON.stringify({ sourceCommit: repo.initial, services: allServices }))

  const result = run(['catch-up', planPath, baselinePath], {
    env: { ...repo.env, SOURCE_COMMIT: sourceCommit }
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(readFileSync(planPath, 'utf8')), {
    sourceCommit,
    services: ['accounts']
  })
})

test('catch-up은 현재 선택을 유지하고 이미 발행한 source의 빈 계획을 불필요하게 확장하지 않는다', (t) => {
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
  assert.deepEqual(
    catchUpPlan({
      ...options,
      plan: { sourceCommit, services: [] },
      baselinePlan: { sourceCommit, services: allServices }
    }).services,
    []
  )
})

test('CLI catch-up에 지정한 baseline이 읽기, 검증에 실패하면 기존 계획을 보존한다', (t) => {
  const repo = repository(t)
  repo.write('apps/api/src/main.ts')
  const sourceCommit = repo.commit()
  const { planPath, run } = createProductImageCliFixture(t, repo.cwd)
  const baselinePath = join(repo.cwd, 'baseline.json')
  const absentBaseline = join(repo.cwd, 'missing-baseline.json')
  const planBody = JSON.stringify({ sourceCommit, services: ['api'] })
  writeFileSync(planPath, planBody)

  for (const options of [
    { path: absentBaseline, body: '{}', error: 'Could not read product image baseline JSON' },
    {
      path: baselinePath,
      body: '{invalid JSON',
      error: 'Could not read product image baseline JSON'
    },
    {
      path: baselinePath,
      body: JSON.stringify({ sourceCommit: repo.initial, services: ['unknown'] }),
      error: 'Expected a plan with unique api, ocr, or accounts services'
    }
  ]) {
    writeFileSync(baselinePath, options.body)
    const result = run(['catch-up', planPath, options.path], {
      env: { ...repo.env, SOURCE_COMMIT: sourceCommit }
    })

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, `${options.error}\n`)
    assert.equal(readFileSync(planPath, 'utf8'), planBody)
    assert.equal(readFileSync(baselinePath, 'utf8'), options.body)
    assert.equal(repo.git('rev-parse', 'HEAD'), sourceCommit)
    assert.equal(existsSync(absentBaseline), false)
  }
})

test('발행 baseline이 없거나 조회 불가, 비조상이면 모든 이미지를 선택한다', (t) => {
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

test('잘못된 baseline API 설정은 token을 전송하거나 네트워크 요청을 만들기 전에 거절한다', async () => {
  const { apiOptions, baselineApi } = createProductImageApiFixture()
  for (const override of [
    { apiUrl: 'not-a-url' },
    { apiUrl: 'http://api.github.com' },
    { apiUrl: 'https://fixture:synthetic-password@api.github.com' },
    { apiUrl: 'https://api.github.com?unexpected=value' },
    { apiUrl: 'https://api.github.com#unexpected' },
    { repository: 'example/product/extra' },
    { token: '' }
  ]) {
    const requests = []
    await assert.rejects(
      findBaselineRun({
        ...apiOptions,
        ...override,
        fetchImpl: baselineApi([{ workflow_runs: [] }], requests)
      }),
      /Expected .*GitHub API URL/
    )
    assert.deepEqual(requests, [])
  }
})

test('baseline 조회는 만료되지 않은 계획 artifact가 있는 성공한 main 실행을 선택한다', async () => {
  const { successfulRun, baselineArtifact, apiOptions, baselineApi } =
    createProductImageApiFixture()
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
  assert.ok(requests[0].options.signal instanceof AbortSignal)
  assert.equal(requests[0].options.signal.aborted, false)
})

test('성공 실행이 없거나 artifact가 없거나 만료되면 사용 가능한 baseline이 없다', async () => {
  const { successfulRun, baselineArtifact, apiOptions, baselineApi } =
    createProductImageApiFixture()
  for (const responses of [
    [{ workflow_runs: [] }],
    [{ workflow_runs: [successfulRun] }, { artifacts: [] }],
    [{ workflow_runs: [successfulRun] }, { artifacts: [{ ...baselineArtifact, expired: true }] }]
  ]) {
    assert.equal(await findBaselineRun({ ...apiOptions, fetchImpl: baselineApi(responses) }), null)
  }
})

test('baseline 조회는 API 실패, 잘못된 실행 identity를 거절하고 요청 오류의 token을 숨긴다', async () => {
  const { successfulRun, apiOptions, baselineApi } = createProductImageApiFixture()
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
  await assert.rejects(
    findBaselineRun({
      ...apiOptions,
      fetchImpl: async () => ({
        ok: true,
        json: async () => {
          throw new Error(`Unreadable response for ${apiOptions.token}`)
        }
      })
    }),
    { message: 'Could not read the successful product image baseline from GitHub' }
  )
})
