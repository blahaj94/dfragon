import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))

// A required check that never starts keeps a pull request pending, so these workflows run on every
// pull request and report the outcome through one gate job whose name the main ruleset can require.
const gatedWorkflows = [
  {
    file: 'desktop-windows.yml',
    gate: 'Desktop Windows gate',
    // Neighbors of the push paths that must not start the Windows tests.
    unrelatedPaths: [
      'apps/api/src/main.ts',
      'apps/desktop-legacy/main.ts',
      'apps/web/package.json',
      'docs/README.md'
    ]
  },
  {
    file: 'workflow-lint.yml',
    gate: 'Workflow Lint gate',
    unrelatedPaths: ['.gitignore', '.github-templates/workflow.yml', 'apps/desktop/src/main.ts']
  }
]

// Commits in the fixture repositories must not read the developer's signing or hook settings.
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Required Gate Test',
  GIT_AUTHOR_EMAIL: 'required-gate@example.invalid',
  GIT_COMMITTER_NAME: 'Required Gate Test',
  GIT_COMMITTER_EMAIL: 'required-gate@example.invalid'
}

function topLevelSection(text, key) {
  return text.split(new RegExp(`^${key}:\\s*$`, 'mu'))[1].split(/^\S/mu)[0]
}

function triggerOf(triggers, event) {
  return triggers.split(/(?=^ {2}[\w-]+:)/mu).find((block) => block.startsWith(`  ${event}:`))
}

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

  return lines
    .slice(runLine + 1)
    .filter((line) => line.startsWith('          '))
    .map((line) => line.slice(10))
    .join('\n')
}

async function readWorkflow(file) {
  const text = await readFile(join(root, '.github/workflows', file), 'utf8')
  const triggers = topLevelSection(text, 'on')
  const jobs = topLevelSection(text, 'jobs')
    .split(/(?=^ {2}[\w-]+:\s*$)/mu)
    .filter((job) => /^ {2}[\w-]+:\s*$/mu.test(job))
  const pushPaths = [...triggerOf(triggers, 'push').matchAll(/^ {6}- '([^']+)'\s*$/gmu)].map(
    ([, path]) => path
  )
  const changes = jobs.find((job) => jobIdOf(job) === 'changes')
  const gate = jobs.find((job) => jobIdOf(job) === 'gate')
  const checks = jobs.filter((job) => job !== changes && job !== gate)
  const pathStep = stepsOf(changes).find((step) => /^ {8}id: paths\s*$/mu.test(step))

  return { triggers, jobs, pushPaths, changes, gate, checks, pathStep }
}

// A file under each push path, so the pull request check covers the same range as the push filter.
function sampleFileOf(pattern) {
  if (pattern.endsWith('/**')) {
    return `${pattern.slice(0, -'**'.length)}sample.txt`
  }

  return pattern
}

async function git(directory, ...args) {
  await run('git', args, { cwd: directory, env: gitEnv, timeout: 20_000 })
}

async function writeFiles(directory, paths) {
  for (const path of paths) {
    await mkdir(dirname(join(directory, path)), { recursive: true })
    await writeFile(join(directory, path), `# ${path}\n`)
  }
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-required-gate-'))
  t.after(() => rm(directory, { recursive: true, force: true }))

  return directory
}

async function commitAll(directory, message) {
  await git(directory, 'add', '--all')
  await git(directory, 'commit', '--quiet', `--message=${message}`)
}

// Recreates the test merge commit that actions/checkout leaves at HEAD for a pull_request run.
// The pull request ends with an unrelated commit, so only its whole range shows the change, and the
// base branch may move after the pull request branched, as it does for an outdated PR.
async function createPullRequestCheckout(t, { baseFiles = [], baseUpdate = [], change }) {
  const directory = await temporaryDirectory(t)
  await git(directory, 'init', '--quiet', '--initial-branch=main')
  await writeFiles(directory, ['README.md', ...baseFiles])
  await commitAll(directory, 'base')
  await git(directory, 'switch', '--quiet', '--create', 'pull-request')
  await change(directory)
  await commitAll(directory, 'change')
  await writeFiles(directory, ['notes/follow-up.txt'])
  await commitAll(directory, 'follow-up')
  await git(directory, 'switch', '--quiet', 'main')

  if (baseUpdate.length > 0) {
    await writeFiles(directory, baseUpdate)
    await commitAll(directory, 'base update')
  }

  await git(directory, 'merge', '--quiet', '--no-ff', '--message=merge', 'pull-request')

  return directory
}

// GitHub runs these steps with its default Linux shell, which is bash with -e.
async function runStep(step, cwd, env) {
  return run('bash', ['-e', '-c', runCommandOf(step)], {
    cwd,
    env: { ...gitEnv, ...env },
    timeout: 20_000
  })
}

async function detectChanges(t, workflow, cwd, eventName) {
  const output = join(await temporaryDirectory(t), 'github-output')
  await writeFile(output, '')
  await runStep(workflow.pathStep, cwd, { EVENT_NAME: eventName, GITHUB_OUTPUT: output })

  return readFile(output, 'utf8')
}

async function runGate(workflow, results) {
  const [step] = stepsOf(workflow.gate)

  return runStep(step, root, { RESULTS: results.join(' ') })
}

for (const { file, gate, unrelatedPaths } of gatedWorkflows) {
  const workflow = await readWorkflow(file)

  test(`${file}: PR은 paths 필터 없이 실행하고 main push는 paths 필터를 유지한다`, () => {
    const pullRequest = triggerOf(workflow.triggers, 'pull_request')
    const push = triggerOf(workflow.triggers, 'push')

    assert.ok(pullRequest, 'pull_request 트리거가 있어야 한다')
    assert.doesNotMatch(pullRequest, /\b(?:paths|paths-ignore|branches|branches-ignore):/u)
    assert.match(push, /^ {4}branches: \[main\]\s*$/mu)
    assert.ok(workflow.pushPaths.length > 0, 'main push는 기존 paths 필터를 유지해야 한다')
  })

  test(`${file}: gate는 고정 이름으로 항상 실행되며 다른 모든 job을 기다린다`, () => {
    assert.ok(workflow.gate, 'gate job이 있어야 한다')
    const settings = settingsOf(workflow.gate)
    const needs = /^ {4}needs:\s*\n((?: {6}- [\w-]+\s*\n)+)/mu.exec(settings)

    assert.match(settings, new RegExp(`^ {4}name: ${gate}\\s*$`, 'mu'))
    assert.match(settings, /^ {4}if: always\(\)\s*$/mu)
    assert.doesNotMatch(settings, /^ {4}continue-on-error:/mu)
    assert.ok(needs, 'gate는 기다릴 job을 needs 목록으로 선언해야 한다')
    assert.deepEqual(
      [...needs[1].matchAll(/- ([\w-]+)/gu)].map(([, id]) => id).sort(),
      workflow.jobs
        .filter((job) => job !== workflow.gate)
        .map(jobIdOf)
        .sort()
    )
  })

  test(`${file}: changes는 env 값과 merge commit으로 판단하고 검사 job은 그 결과로만 건너뛴다`, () => {
    const changesSettings = settingsOf(workflow.changes)
    const checkout = stepsOf(workflow.changes).find((step) => {
      return /^ {8}uses: actions\/checkout@/mu.test(step)
    })

    assert.doesNotMatch(changesSettings, /^ {4}(?:if|continue-on-error):/mu)
    assert.match(changesSettings, /^ {6}needed: \$\{\{ steps\.paths\.outputs\.needed \}\}\s*$/mu)
    // The script compares the merge commit with its first parent, so both must be fetched.
    assert.match(checkout, /^ {10}fetch-depth: 2\s*$/mu)
    assert.match(checkout, /^ {10}persist-credentials: false\s*$/mu)
    // GitHub context values reach the script only through env, never as template expansion.
    assert.match(workflow.pathStep, /^ {10}EVENT_NAME: \$\{\{ github\.event_name \}\}\s*$/mu)
    assert.doesNotMatch(runCommandOf(workflow.pathStep), /\$\{\{/u)
    assert.ok(workflow.checks.length > 0, '검사 job이 있어야 한다')

    for (const job of workflow.checks) {
      const settings = settingsOf(job)

      assert.match(settings, /^ {4}needs: changes\s*$/mu, jobIdOf(job))
      assert.match(
        settings,
        /^ {4}if: needs\.changes\.outputs\.needed == 'true'\s*$/mu,
        jobIdOf(job)
      )
      assert.doesNotMatch(settings, /^ {4}continue-on-error:/mu, jobIdOf(job))
    }
  })

  test(`${file}: gate는 needs 전체 결과를 받아 failure, cancelled면 실패하고 success, skipped면 통과한다`, async () => {
    const [step] = stepsOf(workflow.gate)

    assert.match(step, /^ {10}RESULTS: \$\{\{ join\(needs\.\*\.result, ' '\) \}\}\s*$/mu)
    await runGate(workflow, ['success', 'success', 'success'])
    await runGate(workflow, ['success', 'skipped', 'skipped'])
    await assert.rejects(runGate(workflow, []), { code: 1 }, '전달된 결과 없음')

    for (const result of ['failure', 'cancelled']) {
      await assert.rejects(runGate(workflow, ['success', result, 'skipped']), { code: 1 }, result)
    }
  })

  for (const pattern of workflow.pushPaths) {
    test(`${file}: PR이 push paths의 ${pattern} 경로를 바꾸면 검사를 실행한다`, async (t) => {
      const checkout = await createPullRequestCheckout(t, {
        change: (directory) => writeFiles(directory, [sampleFileOf(pattern)])
      })

      assert.equal(await detectChanges(t, workflow, checkout, 'pull_request'), 'needed=true\n')
    })
  }

  test(`${file}: push paths 밖으로 옮긴 파일도 PR 변경으로 본다`, async (t) => {
    const source = sampleFileOf(workflow.pushPaths.find((pattern) => pattern.endsWith('/**')))
    const checkout = await createPullRequestCheckout(t, {
      baseFiles: [source],
      change: async (directory) => {
        await mkdir(join(directory, 'docs'), { recursive: true })
        await rename(join(directory, source), join(directory, 'docs/moved.txt'))
      }
    })

    assert.equal(await detectChanges(t, workflow, checkout, 'pull_request'), 'needed=true\n')
  })

  test(`${file}: 무관한 PR 변경은 base에만 있는 push paths 변경과 함께여도 검사를 건너뛴다`, async (t) => {
    const checkout = await createPullRequestCheckout(t, {
      baseUpdate: workflow.pushPaths.map(sampleFileOf),
      change: (directory) => writeFiles(directory, unrelatedPaths)
    })

    assert.equal(await detectChanges(t, workflow, checkout, 'pull_request'), 'needed=false\n')
  })

  // A partial checkout without credentials cannot fetch the trees that the comparison needs.
  test(`${file}: PR 변경을 비교하지 못하면 검사를 건너뛰지 않고 실패한다`, async (t) => {
    const source = await createPullRequestCheckout(t, {
      change: (directory) => writeFiles(directory, unrelatedPaths)
    })
    const checkout = await temporaryDirectory(t)
    await git(source, 'config', 'uploadpack.allowFilter', 'true')
    await git(
      checkout,
      'clone',
      '--quiet',
      '--no-checkout',
      '--filter=tree:0',
      pathToFileURL(source).href,
      '.'
    )
    await rm(source, { recursive: true, force: true })

    await assert.rejects(detectChanges(t, workflow, checkout, 'pull_request'), { code: 128 })
  })

  test(`${file}: main push는 checkout 없이 검사를 실행하고 merge가 아닌 PR checkout은 실패한다`, async (t) => {
    const notCheckedOut = await temporaryDirectory(t)
    const linear = await createPullRequestCheckout(t, {
      change: (directory) => writeFiles(directory, unrelatedPaths)
    })
    await git(linear, 'reset', '--quiet', '--hard', 'pull-request')

    assert.equal(await detectChanges(t, workflow, notCheckedOut, 'push'), 'needed=true\n')
    await assert.rejects(detectChanges(t, workflow, linear, 'pull_request'), { code: 1 })
  })
}
