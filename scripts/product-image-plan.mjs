import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const services = ['api', 'ocr', 'accounts']
const commonFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.dockerignore',
  '.npmrc',
  '.github/workflows/product-images.yml',
  '.github/workflows/code-quality.yml',
  'scripts/product-image-plan.mjs',
  'scripts/server-build-info.mjs'
])
const commonDirectories = ['packages/lib/', 'packages/licenses/', 'patches/']

export function selectServices(changedPaths) {
  const selected = new Set()
  for (const path of changedPaths) {
    if (
      commonFiles.has(path) ||
      commonDirectories.some((directory) => path.startsWith(directory))
    ) {

      return [...services]
    }

    for (const service of services) {
      if (path.startsWith(`apps/${service}/`)) {
        selected.add(service)
      }
    }
    if (path.startsWith('packages/ui/')) {
      selected.add('ocr')
      selected.add('accounts')
    }
  }

  return services.filter((service) => selected.has(service))
}

function commitSha(value, name) {
  if (typeof value !== 'string' || !/^[a-f\d]{40}$/i.test(value)) {
    throw new Error(`Expected a 40-character hexadecimal ${name}`)
  }

  return value.toLowerCase()
}

function isRecord(value) {

  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function git(args, cwd) {
  try {

    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    throw new Error('Could not inspect product image source commits')
  }
}

function assertSourceHead(source, cwd) {
  if (git(['rev-parse', '--verify', 'HEAD'], cwd).trim() !== source) {
    throw new Error('Git HEAD does not match the product image source commit')
  }
}

export function createPlan({ eventName, event, sourceCommit, cwd = process.cwd() }) {
  const source = commitSha(sourceCommit, 'source commit')
  assertSourceHead(source, cwd)
  if (!isRecord(event)) {
    throw new Error('Expected a GitHub event object')
  }

  let base
  if (eventName === 'push') {
    if (commitSha(event.after, 'push after commit') !== source) {
      throw new Error('Push after commit does not match the product image source commit')
    }
    base = commitSha(event.before, 'push before commit')
    if (base === '0'.repeat(40)) {

      return { sourceCommit: source, services: [...services] }
    }
  } else if (eventName === 'pull_request') {
    base = commitSha(event.pull_request?.base?.sha, 'pull request base commit')
  } else {
    throw new Error('Expected a push or pull_request event')
  }

  const diff = git(['diff', '--name-only', '--no-renames', '-z', `${base}..${source}`, '--'], cwd)
  const changedPaths = diff.split('\0').filter((path) => path.length > 0)

  return { sourceCommit: source, services: selectServices(changedPaths) }
}

export function validatePlan(plan, sourceCommit) {
  const source = commitSha(sourceCommit, 'source commit')
  if (!isRecord(plan) || commitSha(plan.sourceCommit, 'plan source commit') !== source) {
    throw new Error('Plan source commit does not match the product image source commit')
  }
  if (
    !Array.isArray(plan.services) ||
    plan.services.some((service) => !services.includes(service)) ||
    new Set(plan.services).size !== plan.services.length
  ) {
    throw new Error('Expected a plan with unique api, ocr, or accounts services')
  }

  return {
    sourceCommit: source,
    services: services.filter((service) => plan.services.includes(service))
  }
}

export function catchUpPlan({ plan, baselinePlan, sourceCommit, cwd = process.cwd() }) {
  const current = validatePlan(plan, sourceCommit)
  assertSourceHead(current.sourceCommit, cwd)
  if (baselinePlan === undefined) {

    return { ...current, services: [...services] }
  }

  const baseline = validatePlan(baselinePlan, baselinePlan?.sourceCommit)
  let diff
  try {
    git(['merge-base', '--is-ancestor', baseline.sourceCommit, current.sourceCommit], cwd)
    diff = git(
      [
        'diff',
        '--name-only',
        '--no-renames',
        '-z',
        `${baseline.sourceCommit}..${current.sourceCommit}`,
        '--'
      ],
      cwd
    )
  } catch {

    return { ...current, services: [...services] }
  }

  const changedPaths = diff.split('\0').filter((path) => path.length > 0)
  const selected = new Set([...current.services, ...selectServices(changedPaths)])

  return { ...current, services: services.filter((service) => selected.has(service)) }
}

function positiveId(value) {

  return Number.isSafeInteger(value) && value > 0
}

export async function findBaselineRun({ apiUrl, repository, token, fetchImpl = fetch }) {
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
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    typeof token !== 'string' ||
    token.length === 0
  ) {
    throw new Error('Expected a GitHub API URL, repository, and read token')
  }

  const repoUrl = `${baseUrl.href.replace(/\/$/, '')}/repos/${repository}`
  const request = async (url) => {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(30000)
      })
      if (!response.ok) {
        throw new Error('GitHub API request failed')
      }

      return await response.json()
    } catch {
      throw new Error('Could not read the successful product image baseline from GitHub')
    }
  }

  const runs = await request(
    `${repoUrl}/actions/workflows/product-images.yml/runs?branch=main&event=workflow_run&status=success&per_page=1`
  )
  if (!isRecord(runs) || !Array.isArray(runs.workflow_runs)) {
    throw new Error('Expected a GitHub workflow runs response')
  }
  const run = runs.workflow_runs[0]
  if (run === undefined) {

    return null
  }
  if (
    !isRecord(run) ||
    !positiveId(run.id) ||
    run.event !== 'workflow_run' ||
    run.head_branch !== 'main' ||
    run.conclusion !== 'success'
  ) {
    throw new Error('Expected a successful main product image workflow run')
  }

  const artifacts = await request(`${repoUrl}/actions/runs/${run.id}/artifacts?per_page=100`)
  if (
    !isRecord(artifacts) ||
    !Array.isArray(artifacts.artifacts) ||
    artifacts.artifacts.some(
      (artifact) =>
        !isRecord(artifact) ||
        !positiveId(artifact.id) ||
        typeof artifact.name !== 'string' ||
        typeof artifact.expired !== 'boolean'
    )
  ) {
    throw new Error('Expected a GitHub workflow artifacts response')
  }

  return artifacts.artifacts.some(
    (artifact) => artifact.name === 'product-image-plan' && !artifact.expired
  )
    ? run.id
    : null
}

function readJson(path, name) {
  try {

    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Error(`Could not read ${name} JSON`)
  }
}

function writePlan(path, plan) {
  try {
    writeFileSync(path, `${JSON.stringify(plan)}\n`)
  } catch {
    throw new Error('Could not write the product image plan')
  }
}

function appendOutput(value) {
  if (!process.env.GITHUB_OUTPUT) {
    throw new Error('Expected GITHUB_OUTPUT for product image planning')
  }
  try {
    appendFileSync(process.env.GITHUB_OUTPUT, value)
  } catch {
    throw new Error('Could not write the product image planning output')
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'baseline' && args.length === 0) {
    const runId = await findBaselineRun({
      apiUrl: process.env.GITHUB_API_URL,
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN
    })
    appendOutput(`run_id=${runId ?? ''}\n`)

    return
  }
  if (
    !args[0] ||
    !(
      (['select', 'output'].includes(command) && args.length === 1) ||
      (command === 'catch-up' && args.length <= 2)
    )
  ) {
    throw new Error(
      'Usage: product-image-plan.mjs baseline | <select|output> <plan-file> | catch-up <plan-file> [baseline-plan-file]'
    )
  }

  const [planPath, baselinePath] = args
  const sourceCommit = process.env.SOURCE_COMMIT || process.env.GITHUB_SHA
  if (command === 'select') {
    const plan = createPlan({
      eventName: process.env.GITHUB_EVENT_NAME,
      event: readJson(process.env.GITHUB_EVENT_PATH, 'GitHub event'),
      sourceCommit
    })
    writePlan(planPath, plan)

    return
  }
  if (command === 'catch-up') {
    const plan = catchUpPlan({
      plan: readJson(planPath, 'product image plan'),
      baselinePlan: baselinePath ? readJson(baselinePath, 'product image baseline') : undefined,
      sourceCommit
    })
    writePlan(planPath, plan)

    return
  }

  const plan = validatePlan(readJson(planPath, 'product image plan'), sourceCommit)
  appendOutput(
    `matrix=${JSON.stringify({ service: plan.services })}\nhas_changes=${plan.services.length > 0}\n`
  )
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
