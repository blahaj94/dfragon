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

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))
const configPath = join(root, '.prettierrc.json')
const config = await prettier.resolveConfig(configPath)
const cli = fileURLToPath(import.meta.resolve('prettier/bin/prettier.cjs'))

const fixtures = [
  {
    name: 'first return in a block',
    source: 'function f(){return 1}',
    expected: 'function f() {\n\n  return 1\n}\n'
  },
  {
    name: 'bare return',
    source: 'function f(){return;}',
    expected: 'function f() {\n\n  return\n}\n'
  },
  {
    name: 'missing blank after a statement',
    source: 'function f(){work();return 1}',
    expected: 'function f() {\n  work()\n\n  return 1\n}\n'
  },
  {
    name: 'existing multiple blank lines',
    source: 'function f(){work()\n\n\nreturn 1}',
    expected: 'function f() {\n  work()\n\n  return 1\n}\n'
  },
  {
    name: 'directives and omitted empty statements',
    source: 'function f(){"use strict";\n\n;return 1}',
    expected: "function f() {\n  'use strict'\n\n  return 1\n}\n"
  },
  {
    name: 'if and else blocks',
    source: 'function f(x){if(x){return 1}else{return 2}}',
    expected: 'function f(x) {\n  if (x) {\n\n    return 1\n  } else {\n\n    return 2\n  }\n}\n'
  },
  {
    name: 'unbraced branches',
    source: 'function f(x){if(x)return 1;else return 2}',
    expected: 'function f(x) {\n  if (x)\n\n    return 1\n  else\n\n    return 2\n}\n'
  },
  {
    name: 'switch cases and nested case block',
    source: 'function f(x){switch(x){case 1:return 1;default:{return 2}}}',
    expected:
      'function f(x) {\n  switch (x) {\n    case 1:\n\n      return 1\n    default: {\n\n      return 2\n    }\n  }\n}\n'
  },
  {
    name: 'labeled return',
    source: 'function f(){done:return 1}',
    expected: 'function f() {\n  done:\n\n  return 1\n}\n'
  },
  {
    name: 'line comment before return',
    source: 'function f(){\n// reason\nreturn 1}',
    expected: 'function f() {\n  // reason\n\n  return 1\n}\n'
  },
  {
    name: 'inline block comment before return',
    source: 'function f(){/* reason */ return 1}',
    expected: 'function f() {\n  /* reason */\n\n  return 1\n}\n'
  },
  {
    name: 'comment with an existing blank',
    source: 'function f(){\n/* reason */\n\n\nreturn 1}',
    expected: 'function f() {\n  /* reason */\n\n  return 1\n}\n'
  },
  {
    name: 'trailing comment on the preceding statement',
    source: 'function f(){work(); // reason\nreturn 1}',
    expected: 'function f() {\n  work() // reason\n\n  return 1\n}\n'
  },
  {
    name: 'return argument keeps inline comments',
    source: 'function f(){return /* value */ 1}',
    expected: 'function f() {\n\n  return /* value */ 1\n}\n'
  },
  {
    name: 'ASI keeps a newline after bare return',
    source: 'function f(){return\n(1)}',
    expected: 'function f() {\n\n  return\n  1\n}\n'
  },
  {
    name: 'literal source text is unchanged',
    source: 'function f(){return `line\nreturn value\n\n  return other`}',
    expected: 'function f() {\n\n  return `line\nreturn value\n\n  return other`\n}\n'
  }
]

// Inspect parsed return statements, so strings and comment text are not mistaken for code.
function assertReturnSpacing(ast, source) {
  if (ast == null || typeof ast !== 'object') {

    return
  }

  if (ast.type === 'ReturnStatement') {
    const start = ast.range[0]
    const lines = source.slice(0, start).split('\n')
    const preceding = lines.at(-2)
    const beforeBlank = lines.at(-3)

    assert.equal(preceding, '', 'each return has a blank immediately before it')
    assert.notEqual(beforeBlank, '', 'each return has exactly one preceding blank')
  }

  for (const value of Object.values(ast)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        assertReturnSpacing(child, source)
      }
    } else {
      assertReturnSpacing(value, source)
    }
  }
}

for (const fixture of fixtures) {
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
  test(`shared config applies to .${extension}`, async () => {
    const filepath = `fixture.${extension}`
    const formatted = await prettier.format('function f(){return 1}', { ...config, filepath })

    assert.equal(formatted, fixtures[0].expected)
    assert.equal(await prettier.check(formatted, { ...config, filepath }), true)
  })
}

test('TypeScript and JSX retain the native formatting of return values', async () => {
  const source = 'function View(value: string): JSX.Element {return <div>{value}</div>}'
  const filepath = 'fixture.tsx'
  const formatted = await prettier.format(source, { ...config, filepath })

  assert.equal(
    formatted,
    'function View(value: string): JSX.Element {\n\n  return <div>{value}</div>\n}\n'
  )
  assert.equal(await prettier.format(formatted, { ...config, filepath }), formatted)
  assertReturnSpacing(await parsers.typescript.parse(formatted, { filepath }), formatted)
})

test('ASI, return comments, evaluation order and template values preserve runtime meaning', async () => {
  const sources = [
    'function f(){return\n(1)}; f()',
    'function f(){return /* split\nline */ (1)}; f()',
    'function f(){return (\n{value: 1}\n)}; JSON.stringify(f())',
    'let count=0; function next(){count++;return count} function f(){return next() + next()}; [f(), count].join() ',
    'function f(){return `line\nreturn value\n\n  return other`}; f()'
  ]

  for (const source of sources) {
    const formatted = await prettier.format(source, { ...config, filepath: 'fixture.js' })

    assert.equal(runInNewContext(formatted), runInNewContext(source))
    assert.equal(await prettier.format(formatted, { ...config, filepath: 'fixture.js' }), formatted)
  }
})

test('non-JavaScript printers keep their existing output', async () => {
  const source = '{"return": "value", "items": [1,2]}'
  const expected = await prettier.format(source, { ...config, plugins: [], parser: 'json' })
  const actual = await prettier.format(source, { ...config, parser: 'json' })

  assert.equal(actual, expected)
})

test('CLI write and check resolve the shared plugin from a workspace directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-format-policy-'))
  const filepath = join(directory, 'fixture.ts')
  const options = { cwd: join(root, 'apps/web') }
  const args = [cli, '--config', configPath, '--ignore-path', join(root, '.prettierignore')]

  try {
    await writeFile(filepath, 'function f(){return 1}')
    await assert.rejects(run(process.execPath, [...args, '--check', filepath], options), {
      code: 1
    })
    await run(process.execPath, [...args, '--write', filepath], options)

    assert.equal(await readFile(filepath, 'utf8'), fixtures[0].expected)

    await run(process.execPath, [...args, '--check', filepath], options)
    await run(process.execPath, [...args, '--write', filepath], options)

    assert.equal(await readFile(filepath, 'utf8'), fixtures[0].expected)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
