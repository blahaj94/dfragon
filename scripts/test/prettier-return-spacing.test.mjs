import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'
import prettier from 'prettier'
import { parsers } from 'prettier/plugins/typescript'
import {
  createCliSpacingCase,
  createExtensionSpacingCase,
  createIfRuntimeSources,
  createReturnRuntimeSources,
  createSpacingCases
} from './fixtures/format-policy/cases.mjs'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))
const configPath = join(root, '.prettierrc.json')
const config = await prettier.resolveConfig(configPath)
const cli = fileURLToPath(import.meta.resolve('prettier/bin/prettier.cjs'))

// Inspect parsed return statements, so strings and comment text are not mistaken for code.
function assertReturnSpacing(ast, source, parent) {
  if (ast == null || typeof ast !== 'object') {
    return
  }

  if (ast.type === 'ReturnStatement') {
    const start = ast.range[0]
    const firstStatement = parent?.body?.find?.((statement) => statement.type !== 'EmptyStatement')
    const isFirstInBlock =
      parent?.type === 'BlockStatement' && !parent.directives?.length && firstStatement === ast

    if (isFirstInBlock) {
      const opening = source.slice(parent.range[0], start)
      assert.doesNotMatch(
        opening,
        /^\{\n[ \t]*\n/u,
        'the first block statement has no opening blank'
      )
    } else {
      const lines = source.slice(0, start).split('\n')
      const preceding = lines.at(-2)
      const beforeBlank = lines.at(-3)

      assert.equal(preceding, '', 'later returns have a blank immediately before them')
      assert.notEqual(beforeBlank, '', 'later returns have exactly one preceding blank')
    }
  }

  for (const value of Object.values(ast)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        assertReturnSpacing(child, source, ast)
      }
    } else {
      assertReturnSpacing(value, source, ast)
    }
  }
}

for (const fixture of createSpacingCases()) {
  test(fixture.name, async () => {
    const options = { ...config, filepath: 'fixture.js' }
    const formatted = await prettier.format(fixture.source, options)

    assert.equal(formatted, fixture.expected)
    assert.equal(await prettier.format(formatted, options), formatted)
    assert.equal(await prettier.check(formatted, options), true)
    assertReturnSpacing(await parsers.typescript.parse(formatted, options), formatted)
  })
}

for (const extension of ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']) {
  test(`.${extension} 공통 설정은 주석이 있는 연속 블록 if와 이후 return 앞에 빈 줄을 둔다`, async () => {
    const filepath = `fixture.${extension}`
    const { source: input, expected } = createExtensionSpacingCase()
    const options = { ...config, filepath }
    const formatted = await prettier.format(input, options)

    assert.equal(formatted, expected)
    assert.equal(await prettier.check(formatted, options), true)
    assert.equal(await prettier.format(formatted, options), expected)
  })
}

test('TypeScript와 JSX 반환식의 기본 포맷을 유지한다', async () => {
  const source = 'function View(value: string): JSX.Element {return <div>{value}</div>}'
  const filepath = 'fixture.tsx'
  const formatted = await prettier.format(source, { ...config, filepath })

  assert.equal(
    formatted,
    'function View(value: string): JSX.Element {\n  return <div>{value}</div>\n}\n'
  )
  assert.equal(await prettier.format(formatted, { ...config, filepath }), formatted)
  assertReturnSpacing(await parsers.typescript.parse(formatted, { filepath }), formatted)
})

test('return의 ASI 주석 평가 순서와 템플릿 값의 실행 의미를 보존한다', async () => {
  const sources = createReturnRuntimeSources()

  for (const source of sources) {
    const formatted = await prettier.format(source, { ...config, filepath: 'fixture.js' })

    assert.equal(runInNewContext(formatted), runInNewContext(source))
    assert.equal(await prettier.format(formatted, { ...config, filepath: 'fixture.js' }), formatted)
  }
})

test('블록 없는 if 문은 기본 프린터의 배치를 유지한다', async () => {
  const source = 'function f(a,b){if(a)one();if(b)two()}'
  const options = { ...config, filepath: 'fixture.js' }
  const native = await prettier.format(source, { ...options, plugins: [] })

  assert.equal(await prettier.format(source, options), native)
})

test('연속 if의 주석 ASI 분기 평가의 실행 의미를 보존한다', async () => {
  const sources = createIfRuntimeSources()

  for (const source of sources) {
    const options = { ...config, filepath: 'fixture.js' }
    const formatted = await prettier.format(source, options)

    assert.equal(runInNewContext(formatted), runInNewContext(source))
    assert.equal(await prettier.format(formatted, options), formatted)
  }
})

test('JavaScript 이외 프린터의 출력을 유지한다', async () => {
  const source = '{"return": "value", "items": [1,2]}'
  const expected = await prettier.format(source, { ...config, plugins: [], parser: 'json' })
  const actual = await prettier.format(source, { ...config, parser: 'json' })

  assert.equal(actual, expected)
})

test('workspace에서 실행한 CLI는 공통 플러그인 정책으로 검사하고 수정한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-format-policy-'))
  const filepath = join(directory, 'fixture.ts')
  const options = { cwd: join(root, 'apps/web') }
  const args = [cli, '--config', configPath, '--ignore-path', join(root, '.prettierignore')]
  const { source, expected } = createCliSpacingCase()

  try {
    // Native Prettier already accepts this input; only the shared spacing policy rejects it.
    assert.equal(await prettier.check(source, { ...config, plugins: [], filepath }), true)
    await writeFile(filepath, source)
    await assert.rejects(run(process.execPath, [...args, '--check', filepath], options), {
      code: 1
    })
    assert.equal(await readFile(filepath, 'utf8'), source)

    await run(process.execPath, [...args, '--write', filepath], options)

    assert.equal(await readFile(filepath, 'utf8'), expected)

    await run(process.execPath, [...args, '--check', filepath], options)

    assert.equal(await readFile(filepath, 'utf8'), expected)

    await run(process.execPath, [...args, '--write', filepath], options)

    assert.equal(await readFile(filepath, 'utf8'), expected)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('CLI 구문 오류는 포맷 불일치와 다른 종료값으로 실패하고 파일을 보존한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-format-policy-invalid-'))
  const filepath = join(directory, 'invalid.ts')
  const source = 'function f( {'

  try {
    await writeFile(filepath, source)
    await assert.rejects(
      run(process.execPath, [cli, '--config', configPath, '--check', filepath], {
        cwd: join(root, 'apps/web')
      }),
      { code: 2 }
    )
    assert.equal(await readFile(filepath, 'utf8'), source)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
