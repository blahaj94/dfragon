import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const triggerScript = join(repositoryRoot, 'scripts/pr-review/src/trigger.mjs')

function baseEnvironment(overrides = {}) {
  const environment = { ...process.env }
  for (const name of [
    'GITHUB_EVENT_PATH',
    'GITHUB_TOKEN',
    'REVIEW_TRIGGER_TOKEN',
    'REVIEW_TRIGGER_ACTOR'
  ]) {
    delete environment[name]
  }
  return { ...environment, ...overrides }
}

function execute(scriptPath, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repositoryRoot,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }))
  })
}

test('rejects missing and empty required environment values in the trigger entry point', async () => {
  for (const value of [undefined, '']) {
    const environment = baseEnvironment()
    if (value !== undefined) {
      environment.GITHUB_EVENT_PATH = value
    }

    const result = await execute(triggerScript, environment)

    assert.equal(result.code, 1)
    assert.match(result.stderr, /Missing required environment variable: GITHUB_EVENT_PATH/)
  }
})

test('failed source workflow skips the trigger before token or API access', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ldb-pr-review-runtime-'))
  try {
    const eventPath = join(directory, 'event.json')
    await writeFile(eventPath, JSON.stringify({ workflow_run: { conclusion: 'failure' } }), 'utf8')

    const result = await execute(triggerScript, baseEnvironment({ GITHUB_EVENT_PATH: eventPath }))

    assert.equal(result.code, 0)
    assert.match(result.stdout, /AI provider trigger skipped: source_workflow_failed/)
    assert.doesNotMatch(result.stdout, /Requested .* review/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
