import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { applyStatementSpacing } from '../statement-spacing.mjs'
import {
  createCliSpacingCase,
  createExtensionSpacingCase,
  createIfRuntimeSources,
  createReturnRuntimeSources,
  createSpacingCases
} from './fixtures/format-policy/cases.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const biome = createRequire(join(root, 'package.json')).resolve('@biomejs/biome/bin/biome')
const spacingCli = join(root, 'scripts/statement-spacing.mjs')
const DIAGNOSTIC_LINE_PATTERN = /^\S+:\d+: /

function biomeFormat(source, filepath) {
  const args = [biome, 'format', `--stdin-file-path=${filepath}`]

  return execFileSync(process.execPath, args, { cwd: root, input: source, encoding: 'utf8' })
}

// `pnpm format`과 같은 순서로 Biome 포맷 뒤 문장 간격 정책을 적용한다.
function format(source, filepath) {
  return applyStatementSpacing(biomeFormat(source, filepath), filepath).text
}

function assertConverged(formatted, filepath) {
  const { missing, unresolved } = applyStatementSpacing(formatted, filepath)

  assert.equal(
    biomeFormat(formatted, filepath),
    formatted,
    'Biome 검사가 결과를 다시 바꾸지 않는다'
  )
  assert.deepEqual([...missing, ...unresolved], [], '간격 검사가 결과를 통과시킨다')
}

async function createSpacingRepository(t, files) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-statement-spacing-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  execFileSync('git', ['init', '--quiet'], { cwd: directory })
  await copyFile(join(root, 'biome.json'), join(directory, 'biome.json'))

  for (const [path, source] of Object.entries(files)) {
    await mkdir(dirname(join(directory, path)), { recursive: true })
    await writeFile(join(directory, path), source)
  }

  return directory
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [spacingCli, ...args], { cwd, encoding: 'utf8' })
}

for (const fixture of createSpacingCases()) {
  test(fixture.name, () => {
    const formatted = format(fixture.source, 'fixture.js')

    assert.equal(formatted, fixture.expected)
    assertConverged(formatted, 'fixture.js')
  })
}

for (const extension of ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']) {
  test(`.${extension} 파일은 주석이 있는 연속 블록 if와 이후 return 앞에 빈 줄을 둔다`, () => {
    const filepath = `fixture.${extension}`
    const { source, expected } = createExtensionSpacingCase()
    const formatted = format(source, filepath)

    assert.equal(formatted, expected)
    assertConverged(formatted, filepath)
  })
}

test('TypeScript와 JSX 반환식의 기본 포맷을 유지한다', () => {
  const source = 'function View(value: string): JSX.Element {return <div>{value}</div>}'
  const formatted = format(source, 'fixture.tsx')

  assert.equal(
    formatted,
    'function View(value: string): JSX.Element {\n  return <div>{value}</div>\n}\n'
  )
  assertConverged(formatted, 'fixture.tsx')
})

test('return의 ASI 주석 평가 순서와 템플릿 값의 실행 의미를 보존한다', () => {
  for (const source of createReturnRuntimeSources()) {
    const formatted = format(source, 'fixture.js')

    assert.equal(runInNewContext(formatted), runInNewContext(source))
    assertConverged(formatted, 'fixture.js')
  }
})

test('블록 없는 if 문은 Biome의 배치를 유지한다', () => {
  const source = 'function f(a,b){if(a)one();if(b)two()}'

  assert.equal(format(source, 'fixture.js'), biomeFormat(source, 'fixture.js'))
})

test('연속 if의 주석 ASI 분기 평가의 실행 의미를 보존한다', () => {
  for (const source of createIfRuntimeSources()) {
    const formatted = format(source, 'fixture.js')

    assert.equal(runInNewContext(formatted), runInNewContext(source))
    assertConverged(formatted, 'fixture.js')
  }
})

test('같은 줄에 이어진 문장은 고치지 않고 Biome 포맷이 먼저 필요하다고 보고한다', () => {
  const source = 'function f() {\n  work(); return 1\n}\n'
  const { text, missing, unresolved } = applyStatementSpacing(source, 'fixture.js')

  assert.equal(text, source)
  assert.deepEqual(missing, [])
  assert.deepEqual(
    unresolved.map(({ line, kind }) => ({ line, kind })),
    [{ line: 2, kind: 'return' }]
  )
})

test('저장소 루트의 CLI는 Biome 제외 경로와 gitignore 대상을 검사하지 않는다', async (t) => {
  const { source } = createCliSpacingCase()
  const directory = await createSpacingRepository(t, {
    '.gitignore': 'apps/web/generated-output/\n',
    'apps/web/src/fixture.ts': source,
    'apps/web/dist/fixture.js': source,
    'apps/web/generated-output/fixture.js': source,
    'packages/ui/src/seed/fixture.tsx': source
  })
  const result = runCli(['--check'], directory)
  const reported = result.stderr.split('\n').filter((line) => DIAGNOSTIC_LINE_PATTERN.test(line))

  assert.equal(result.status, 1)
  assert.deepEqual(reported, [
    'apps/web/src/fixture.ts:3: return 앞에 빈 줄이 필요합니다.',
    'apps/web/src/fixture.ts:9: 연속된 블록 if 사이에 빈 줄이 필요합니다.'
  ])
})

test('workspace에서 실행한 CLI는 그 workspace만 검사하고 수정한다', async (t) => {
  const { source, expected } = createCliSpacingCase()
  const directory = await createSpacingRepository(t, {
    'apps/web/src/fixture.ts': source,
    'scripts/fixture.mjs': source
  })
  const workspace = join(directory, 'apps/web')
  const target = join(workspace, 'src/fixture.ts')

  assert.equal(runCli(['--check'], workspace).status, 1)
  assert.equal(await readFile(target, 'utf8'), source)
  assert.equal(runCli(['--write'], workspace).status, 0)
  assert.equal(await readFile(target, 'utf8'), expected)
  assert.equal(runCli(['--check'], workspace).status, 0)
  assert.equal(runCli(['--write'], workspace).status, 0)
  assert.equal(await readFile(target, 'utf8'), expected)
  assert.equal(await readFile(join(directory, 'scripts/fixture.mjs'), 'utf8'), source)
})

test('CLI 구문 오류는 간격 불일치와 다른 종료값으로 실패하고 파일을 보존한다', async (t) => {
  const source = 'function f( {\n  work()\n  return 1\n'
  const directory = await createSpacingRepository(t, { 'apps/web/src/invalid.ts': source })
  const target = join(directory, 'apps/web/src/invalid.ts')

  for (const mode of ['--check', '--write']) {
    const result = runCli([mode], directory)

    assert.equal(result.status, 2, mode)
    assert.match(result.stderr, /apps\/web\/src\/invalid\.ts: 구문 오류/u, mode)
    assert.equal(await readFile(target, 'utf8'), source, mode)
  }
})
