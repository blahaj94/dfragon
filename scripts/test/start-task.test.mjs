import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { startTask } from '../start-task.mjs'
import { createStartTaskFixture as fixture } from './fixtures/task-tools/start-task.mjs'

const script = fileURLToPath(new URL('../start-task.mjs', import.meta.url))

test('새로 fetch한 main에서 Issue worktree를 만들고 원래 checkout의 변경을 보존한다', (t) => {
  const f = fixture(t)
  writeFileSync(join(f.repository, 'README.md'), 'new main\n')
  f.git(['commit', '--no-verify', '-am', 'new main'])
  const latest = f.git(['rev-parse', 'HEAD'])
  f.git(['push', 'origin', 'main'])
  f.git(['reset', '--hard', 'HEAD~1'])
  writeFileSync(join(f.repository, 'local.txt'), 'keep me\n')
  const headBefore = f.git(['rev-parse', 'HEAD'])

  const result = startTask(['api', '30', 'fix-search', f.destination], f.run)

  assert.equal(f.git(['rev-parse', 'HEAD'], f.destination), latest)
  assert.equal(f.git(['branch', '--show-current'], f.destination), 'api-30-fix-search')
  assert.equal(f.git(['rev-parse', 'HEAD']), headBefore)
  assert.equal(readFileSync(join(f.repository, 'local.txt'), 'utf8'), 'keep me\n')
  assert.match(result, /Test task/)
  assert.match(result, /https:\/\/example\.invalid\/issues\/30/)
  const hasDestinationContext = result.includes(f.destination)
  assert.ok(hasDestinationContext)
  assert.deepEqual(f.calls[0], ['gh', 'issue', 'view', '30', '--json', 'number,title,url,state'])
})

test('허용한 workspace와 공용 범위별 브랜치를 만들고 기존 브랜치는 보존한다', (t) => {
  const f = fixture(t)
  f.git(['branch', 'codex/issue-30'])
  const legacyHead = f.git(['rev-parse', 'codex/issue-30'])

  for (const project of ['api', 'desktop', 'web', 'ui', 'cross', 'repo']) {
    const destination = join(f.repository, `${project}-worktree`)
    const result = startTask([project, '30', 'add-oauth2-login', destination], f.run)
    const branch = `${project}-30-add-oauth2-login`

    assert.equal(f.git(['branch', '--show-current'], destination), branch)
    const hasBranchContext = result.includes(`Branch: ${branch}`)
    assert.ok(hasBranchContext)
  }

  assert.equal(f.git(['rev-parse', 'codex/issue-30']), legacyHead)
})

test('잘못된 인자는 외부 명령을 실행하기 전에 사용법 오류로 거절한다', () => {
  for (const args of [
    [],
    ['30', 'target'],
    ['api', '30', 'fix-search'],
    ['api', '0', 'fix-search', 'target'],
    ['api', '030', 'fix-search', 'target'],
    ['api', '-1', 'fix-search', 'target'],
    ['api', '1;echo', 'fix-search', 'target'],
    ['api', '9007199254740992', 'fix-search', 'target'],
    ['api', '30', 'fix-search', ' '],
    ['api', '30', 'fix-search', 'target', 'extra'],
    ['dfragon', '30', 'fix-search', 'target'],
    ['API', '30', 'fix-search', 'target'],
    ['api', '30', '', 'target'],
    ['api', '30', 'Fix-search', 'target'],
    ['api', '30', 'fix/search', 'target'],
    ['api', '30', 'fix--search', 'target'],
    ['api', '30', '-fix-search', 'target'],
    ['api', '30', 'fix-search-', 'target'],
    ['api', '30', 'fix search', 'target'],
    ['api', '30', 'fix-search\n', 'target']
  ]) {
    assert.throws(() => startTask(args, () => assert.fail('must not invoke a command')), /사용법/)
  }
})

test('닫힌 Issue·번호 불일치·GitHub 실패에서는 fetch하거나 worktree를 만들지 않는다', (t) => {
  const f = fixture(t)
  f.issue.state = 'CLOSED'
  assert.throws(() => startTask(['api', '30', 'fix-search', f.destination], f.run), /OPEN/)
  f.issue.state = 'OPEN'
  f.issue.number = 31
  assert.throws(() => startTask(['api', '30', 'fix-search', f.destination], f.run), /Issue/)
  const hasOnlyIssueLookupCalls = f.calls.every(([command]) => command === 'gh')
  assert.ok(hasOnlyIssueLookupCalls)
  assert.throws(
    () =>
      startTask(['api', '30', 'fix-search', f.destination], () => {
        throw new Error('GitHub unavailable')
      }),
    /GitHub unavailable/
  )
  const isDestinationPresent = existsSync(f.destination)
  assert.equal(isDestinationPresent, false)
})

test('fetch가 실패하면 이전 origin/main으로 브랜치나 worktree를 만들지 않는다', (t) => {
  const f = fixture(t)
  f.git(['remote', 'set-url', 'origin', join(f.repository, 'missing-origin.git')])
  assert.throws(() => startTask(['api', '30', 'fix-search', f.destination], f.run))
  const isDestinationPresent = existsSync(f.destination)
  assert.equal(isDestinationPresent, false)
  assert.equal(f.git(['branch', '--list', 'api-30-fix-search']), '')
})

test('기존 대상 경로와 같은 이름의 브랜치를 덮어쓰지 않는다', (t) => {
  const f = fixture(t)
  mkdirSync(f.destination)
  assert.throws(() => startTask(['api', '30', 'fix-search', f.destination], f.run), /이미 존재/)
  assert.equal(f.git(['branch', '--list', 'api-30-fix-search']), '')
  writeFileSync(join(f.destination, 'keep.txt'), 'keep\n')
  assert.throws(() => startTask(['api', '30', 'fix-search', f.destination], f.run), /이미 존재/)
  assert.equal(readFileSync(join(f.destination, 'keep.txt'), 'utf8'), 'keep\n')

  f.git(['branch', 'api-30-fix-search'])
  const original = f.git(['rev-parse', 'api-30-fix-search'])
  const otherPath = join(f.repository, 'other-worktree')
  assert.throws(() => startTask(['api', '30', 'fix-search', otherPath], f.run))
  assert.equal(f.git(['rev-parse', 'api-30-fix-search']), original)
  const isOtherPathPresent = existsSync(otherPath)
  assert.equal(isOtherPathPresent, false)
})

test('깨진 심볼릭 링크 경로는 조회·fetch 전에 거절하고 링크와 기존 브랜치를 보존한다', (t) => {
  const f = fixture(t)
  const missingTarget = join(f.repository, 'missing-worktree')
  symlinkSync(missingTarget, f.destination)
  const branchesBefore = f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'])

  assert.throws(() => startTask(['api', '30', 'fix-search', f.destination], f.run), /이미 존재/)

  assert.deepEqual(f.calls, [])
  assert.equal(lstatSync(f.destination).isSymbolicLink(), true)
  assert.equal(readlinkSync(f.destination), missingTarget)
  assert.equal(existsSync(missingTarget), false)
  assert.equal(
    f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']),
    branchesBefore
  )
})

test('CLI는 상대 경로와 공백을 해석하고 생성한 Issue·브랜치·base를 정확히 출력한다', (t) => {
  const f = fixture(t)
  const base = f.git(['rev-parse', 'HEAD'])
  writeFileSync(join(f.repository, 'README.md'), 'local tracked changes\n')
  writeFileSync(join(f.repository, 'local.txt'), 'local untracked changes\n')

  const result = f.cli(['api', '30', 'fix-search', '../worktree with spaces'])

  assert.equal(result.status, 0, result.stderr)
  assert.equal(
    result.stdout,
    [
      'Issue #30: Test task',
      'https://example.invalid/issues/30',
      'Branch: api-30-fix-search',
      `Worktree: ${f.destination}`,
      `Base: ${base}`,
      '제품 계약: docs/README.md | 명령: scripts/README.md',
      ''
    ].join('\n')
  )
  assert.equal(f.git(['rev-parse', 'HEAD'], f.destination), base)
  assert.equal(f.git(['branch', '--show-current'], f.destination), 'api-30-fix-search')
  assert.equal(readFileSync(join(f.destination, 'README.md'), 'utf8'), 'initial\n')
  assert.equal(readFileSync(join(f.repository, 'README.md'), 'utf8'), 'local tracked changes\n')
  assert.equal(readFileSync(join(f.repository, 'local.txt'), 'utf8'), 'local untracked changes\n')
  assert.equal(f.git(['branch', '--show-current']), 'main')
})

test('Git의 checkout hook 실패 뒤에도 생성된 자원과 기존 checkout을 자동 삭제하지 않는다', (t) => {
  const f = fixture(t)
  const base = f.git(['rev-parse', 'HEAD'])
  const hooks = join(f.repository, 'fixture-hooks')
  const hook = join(hooks, 'post-checkout')
  mkdirSync(hooks)
  copyFileSync(
    fileURLToPath(new URL('./fixtures/task-tools/start-task-post-checkout.sh', import.meta.url)),
    hook
  )
  chmodSync(hook, 0o700)
  f.git(['config', 'core.hooksPath', hooks])
  writeFileSync(join(f.repository, 'local.txt'), 'keep me after partial failure\n')

  const result = f.cli(['api', '30', 'fix-search', f.destination])

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /Command failed: git worktree add/)
  assert.equal(f.git(['rev-parse', 'api-30-fix-search']), base)
  assert.equal(f.git(['rev-parse', 'HEAD'], f.destination), base)
  assert.equal(readFileSync(join(f.destination, 'README.md'), 'utf8'), 'initial\n')
  assert.equal(
    readFileSync(join(f.repository, 'local.txt'), 'utf8'),
    'keep me after partial failure\n'
  )
  assert.equal(f.git(['branch', '--show-current']), 'main')
})

test('CLI의 Issue 조회 실패는 성공 문맥을 출력하거나 Git 자원을 만들지 않는다', (t) => {
  const f = fixture(t)
  const branchesBefore = f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'])

  for (const overrides of [
    { START_TASK_GH_EXIT: '19' },
    { START_TASK_ISSUE: '{invalid JSON' },
    { START_TASK_ISSUE: JSON.stringify({ ...f.issue, state: 'CLOSED' }) }
  ]) {
    const result = f.cli(['api', '30', 'fix-search', f.destination], overrides)

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.equal(existsSync(f.destination), false)
    assert.equal(
      f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']),
      branchesBefore
    )
  }
})

test('CLI는 잘못된 입력을 실패 exit status와 사용법 오류로 보고한다', () => {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /사용법/)
})
