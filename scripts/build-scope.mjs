import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// feat(build):, fix(build)!: 처럼 Conventional Commits scope가 build인 PR 제목만 빌드와 전체 검사를 요청한다.
const BUILD_TITLE_PATTERN = /^[a-z]+\(build\)!?:/iu
// Dependabot PR은 로컬 pre-push 검사를 거치지 않으므로 제목과 관계없이 CI에서 모두 검사한다.
const DEPENDABOT_LOGIN = 'dependabot[bot]'
const COMMIT_PATTERN = /^[a-f\d]{40}$/iu
const GITHUB_REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/u
const GITHUB_API_BASE_PATH_SUFFIX_PATTERN = /\/$/u

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requestsBuild({ title, author }) {
  if (author === DEPENDABOT_LOGIN) {
    return true
  }

  return typeof title === 'string' && BUILD_TITLE_PATTERN.test(title)
}

// Rebase merge로 main에 올라간 commit도 GitHub이 원래 PR과 연결해 둔다.
export async function findMergedPullRequest({
  apiUrl,
  repository,
  commit,
  token,
  fetchImpl = fetch
}) {
  let baseUrl
  try {
    baseUrl = new URL(apiUrl)
  } catch {
    throw new Error('Expected a valid GitHub API URL')
  }
  if (
    baseUrl.protocol !== 'https:' ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    typeof repository !== 'string' ||
    !GITHUB_REPOSITORY_PATTERN.test(repository) ||
    typeof commit !== 'string' ||
    !COMMIT_PATTERN.test(commit) ||
    typeof token !== 'string' ||
    token.length === 0
  ) {
    throw new Error('Expected a GitHub API URL, repository, commit, and read token')
  }

  const url = `${baseUrl.href.replace(GITHUB_API_BASE_PATH_SUFFIX_PATTERN, '')}/repos/${repository}/commits/${commit}/pulls?per_page=100`
  let pullRequests
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30000)
    })
    if (!response.ok) {
      throw new Error('GitHub API request failed')
    }

    pullRequests = await response.json()
  } catch {
    throw new Error('Could not read the pull request of the pushed commit from GitHub')
  }

  if (!Array.isArray(pullRequests) || pullRequests.some((pullRequest) => !isRecord(pullRequest))) {
    throw new Error('Expected a GitHub pull requests response')
  }

  const merged = pullRequests.find((pullRequest) => typeof pullRequest.merged_at === 'string')
  if (merged === undefined) {
    return null
  }

  if (typeof merged.title !== 'string' || !isRecord(merged.user)) {
    throw new Error('Expected a merged pull request with a title and author')
  }

  return { title: merged.title, author: merged.user.login }
}

export async function resolveBuildScope({ eventName, pullRequest, lookup }) {
  if (eventName === 'workflow_dispatch') {
    return true
  }

  if (eventName === 'pull_request') {
    return requestsBuild(pullRequest)
  }

  // Product Images는 main push의 Code Quality가 끝난 뒤 workflow_run으로 시작한다.
  if (eventName === 'push' || eventName === 'workflow_run') {
    const merged = await lookup()
    if (merged === null) {
      return false
    }

    return requestsBuild(merged)
  }

  throw new Error('Expected a pull_request, push, workflow_run, or workflow_dispatch event')
}

async function main() {
  if (process.argv.length > 2) {
    throw new Error('Usage: build-scope.mjs')
  }

  if (!process.env.GITHUB_OUTPUT) {
    throw new Error('Expected GITHUB_OUTPUT for the build scope')
  }

  const build = await resolveBuildScope({
    eventName: process.env.EVENT_NAME,
    pullRequest: { title: process.env.PR_TITLE, author: process.env.PR_AUTHOR },
    lookup: () =>
      findMergedPullRequest({
        apiUrl: process.env.GITHUB_API_URL,
        repository: process.env.GITHUB_REPOSITORY,
        commit: process.env.SOURCE_COMMIT,
        token: process.env.GITHUB_TOKEN
      })
  })
  try {
    appendFileSync(process.env.GITHUB_OUTPUT, `build=${build}\n`)
  } catch {
    throw new Error('Could not write the build scope output')
  }
  console.log(`build=${build}`)
}

const entryPath = process.argv[1]
if (entryPath != null && import.meta.url === pathToFileURL(entryPath).href) {
  try {
    await main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
