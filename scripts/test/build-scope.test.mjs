import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { findMergedPullRequest, requestsBuild, resolveBuildScope } from '../build-scope.mjs'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../build-scope.mjs', import.meta.url))
const commit = 'a'.repeat(40)
const apiOptions = {
  apiUrl: 'https://api.github.com',
  repository: 'example/product',
  commit,
  token: 'synthetic-read-token'
}

function pullRequestsApi(body, requests = []) {
  return async (url, options) => {
    requests.push({ url, options })

    return { ok: true, json: async () => body }
  }
}

test('scope가 build인 Conventional Commits 제목만 빌드를 요청한다', () => {
  for (const title of [
    'feat(build): 공대 식별을 서버에서 확정',
    'fix(build): 캡처 실패를 고침',
    'Chore(build)!: Node 26으로 올림'
  ]) {
    assert.equal(requestsBuild({ title, author: 'someone' }), true, title)
  }

  for (const title of [
    'feat: 공대 식별을 서버에서 확정',
    'fix(desktop): 캡처 실패를 고침',
    '빌드 설정 정리 (build)',
    'feat(build) 콜론 없음',
    'feat(builder): 다른 scope',
    ''
  ]) {
    assert.equal(requestsBuild({ title, author: 'someone' }), false, title)
  }

  assert.equal(requestsBuild({ title: undefined, author: 'someone' }), false)
})

test('Dependabot PR은 제목과 관계없이 빌드를 요청한다', () => {
  assert.equal(requestsBuild({ title: 'Chore(deps): Bump vite', author: 'dependabot[bot]' }), true)
})

test('수동 실행은 항상, PR은 제목으로 빌드 여부를 정하고 main 조회를 하지 않는다', async () => {
  const lookup = async () => {
    throw new Error('PR 이벤트는 commit의 PR을 조회하지 않는다')
  }

  assert.equal(await resolveBuildScope({ eventName: 'workflow_dispatch', lookup }), true)
  assert.equal(
    await resolveBuildScope({
      eventName: 'pull_request',
      pullRequest: { title: 'feat(build): 빌드', author: 'someone' },
      lookup
    }),
    true
  )
  assert.equal(
    await resolveBuildScope({
      eventName: 'pull_request',
      pullRequest: { title: 'feat: 빌드 없음', author: 'someone' },
      lookup
    }),
    false
  )
})

test('main push와 그 뒤의 workflow_run은 merge된 PR 제목으로 정하고 PR이 없으면 빌드하지 않는다', async () => {
  for (const eventName of ['push', 'workflow_run']) {
    const build = { title: 'feat(build): 빌드', author: 'someone' }
    const plain = { title: 'feat: 빌드 없음', author: 'someone' }

    assert.equal(await resolveBuildScope({ eventName, lookup: async () => build }), true)
    assert.equal(await resolveBuildScope({ eventName, lookup: async () => plain }), false)
    assert.equal(await resolveBuildScope({ eventName, lookup: async () => null }), false)
  }

  await assert.rejects(
    resolveBuildScope({ eventName: 'schedule', lookup: async () => null }),
    /Expected a pull_request, push/
  )
})

test('commit의 PR 조회는 merge된 PR의 제목과 작성자를 돌려준다', async () => {
  const requests = []
  const merged = await findMergedPullRequest({
    ...apiOptions,
    fetchImpl: pullRequestsApi(
      [
        { title: 'feat(build): 닫힌 PR', merged_at: null, user: { login: 'someone' } },
        { title: 'fix: merge된 PR', merged_at: '2026-10-21T00:00:00Z', user: { login: 'agent' } }
      ],
      requests
    )
  })

  assert.deepEqual(merged, { title: 'fix: merge된 PR', author: 'agent' })
  assert.equal(
    requests[0].url,
    `https://api.github.com/repos/example/product/commits/${commit}/pulls?per_page=100`
  )
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${apiOptions.token}`)
  assert.equal(requests[0].options.redirect, 'error')
  assert.ok(requests[0].options.signal instanceof AbortSignal)
})

test('merge된 PR이 없으면 null을 돌려준다', async () => {
  for (const body of [[], [{ title: 'feat(build): 열린 PR', merged_at: null, user: {} }]]) {
    assert.equal(
      await findMergedPullRequest({ ...apiOptions, fetchImpl: pullRequestsApi(body) }),
      null
    )
  }
})

test('잘못된 조회 설정은 네트워크 요청 전에 거절한다', async () => {
  for (const override of [
    { apiUrl: 'not-a-url' },
    { apiUrl: 'http://api.github.com' },
    { apiUrl: 'https://fixture:synthetic-password@api.github.com' },
    { repository: 'example/product/extra' },
    { commit: 'main' },
    { commit: undefined },
    { token: '' }
  ]) {
    const requests = []
    await assert.rejects(
      findMergedPullRequest({
        ...apiOptions,
        ...override,
        fetchImpl: pullRequestsApi([], requests)
      }),
      /Expected .*GitHub API URL/
    )
    assert.deepEqual(requests, [])
  }
})

test('잘못된 응답은 거절하고 API 실패는 token 없이 실패한다', async () => {
  for (const [body, message] of [
    [{}, 'Expected a GitHub pull requests response'],
    [[null], 'Expected a GitHub pull requests response'],
    [
      [{ merged_at: '2026-10-21T00:00:00Z', user: {} }],
      'Expected a merged pull request with a title and author'
    ]
  ]) {
    await assert.rejects(
      findMergedPullRequest({ ...apiOptions, fetchImpl: pullRequestsApi(body) }),
      { message }
    )
  }

  for (const fetchImpl of [
    async () => ({ ok: false }),
    async () => {
      throw new Error(`Request failed with ${apiOptions.token}`)
    }
  ]) {
    await assert.rejects(findMergedPullRequest({ ...apiOptions, fetchImpl }), {
      message: 'Could not read the pull request of the pushed commit from GitHub'
    })
  }
})

test('Build Scope workflow가 넘기는 env로 CLI가 PR 제목을 읽어 build 출력을 기록한다', async (t) => {
  const workflow = await readFile(
    fileURLToPath(new URL('../../.github/workflows/build-scope.yml', import.meta.url)),
    'utf8'
  )

  for (const line of [
    'EVENT_NAME: ${{ github.event_name }}',
    'PR_TITLE: ${{ github.event.pull_request.title }}',
    'PR_AUTHOR: ${{ github.event.pull_request.user.login }}',
    'SOURCE_COMMIT: ${{ github.event.workflow_run.head_sha || github.sha }}',
    'GITHUB_TOKEN: ${{ github.token }}'
  ]) {
    assert.ok(workflow.includes(`          ${line}\n`), line)
  }

  assert.ok(workflow.includes('        run: node scripts/build-scope.mjs\n'))

  const directory = await mkdtemp(join(tmpdir(), 'build-scope-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const output = join(directory, 'github-output')
  const env = { ...process.env, EVENT_NAME: 'pull_request', GITHUB_OUTPUT: output }

  for (const [title, author, expected] of [
    ['feat(build): 빌드', 'someone', 'build=true\n'],
    ['Chore(deps): Bump vite', 'dependabot[bot]', 'build=true\n'],
    ['feat: 빌드 없음', 'someone', 'build=false\n']
  ]) {
    await writeFile(output, '')
    await run(process.execPath, [script], { env: { ...env, PR_TITLE: title, PR_AUTHOR: author } })

    assert.equal(await readFile(output, 'utf8'), expected, title)
  }
})
