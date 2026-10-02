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
    name: '블록 첫 return 앞에는 빈 줄을 넣지 않는다',
    source: 'function f(){return 1}',
    expected: 'function f() {\n  return 1\n}\n'
  },
  {
    name: '블록 첫 bare return 앞에는 빈 줄을 넣지 않는다',
    source: 'function f(){return;}',
    expected: 'function f() {\n  return\n}\n'
  },
  {
    name: '블록 첫 return 앞의 기존 빈 줄은 제거한다',
    source: 'function f(){\n\n\nreturn 1}',
    expected: 'function f() {\n  return 1\n}\n'
  },
  {
    name: '빈 문장은 블록 첫 return 앞에 빈 줄을 만들지 않는다',
    source: 'function f(){;;;return 1}',
    expected: 'function f() {\n  return 1\n}\n'
  },
  {
    name: '화살표 함수 블록 첫 return 앞에는 빈 줄을 넣지 않는다',
    source: 'const f=()=>{return 1}',
    expected: 'const f = () => {\n  return 1\n}\n'
  },
  {
    name: 'directive 뒤 return 앞에는 빈 줄을 둔다',
    source: 'function f(){"use strict";return 1}',
    expected: "function f() {\n  'use strict'\n\n  return 1\n}\n"
  },
  {
    name: '바깥 문장은 중첩 블록 첫 return의 간격을 바꾸지 않는다',
    source: 'function f(x){work();if(x){return 1}return 2}',
    expected: 'function f(x) {\n  work()\n  if (x) {\n    return 1\n  }\n\n  return 2\n}\n'
  },
  {
    name: 'try catch finally 블록 첫 return 앞에는 빈 줄을 넣지 않는다',
    source: 'function f(){try{return 1}catch{return 2}finally{return 3}}',
    expected:
      'function f() {\n  try {\n    return 1\n  } catch {\n    return 2\n  } finally {\n    return 3\n  }\n}\n'
  },
  {
    name: '앞에 다른 문장이 있으면 return 앞에 빈 줄을 둔다',
    source: 'function f(){work();return 1}',
    expected: 'function f() {\n  work()\n\n  return 1\n}\n'
  },
  {
    name: 'return 앞의 여러 빈 줄은 한 줄로 수렴한다',
    source: 'function f(){work()\n\n\nreturn 1}',
    expected: 'function f() {\n  work()\n\n  return 1\n}\n'
  },
  {
    name: 'directive 뒤 빈 문장을 제거해도 return 앞의 빈 줄을 유지한다',
    source: 'function f(){"use strict";\n\n;return 1}',
    expected: "function f() {\n  'use strict'\n\n  return 1\n}\n"
  },
  {
    name: 'if와 else 블록 첫 return의 간격을 유지한다',
    source: 'function f(x){if(x){return 1}else{return 2}}',
    expected: 'function f(x) {\n  if (x) {\n    return 1\n  } else {\n    return 2\n  }\n}\n'
  },
  {
    name: '블록 없는 분기의 return 앞에는 빈 줄을 둔다',
    source: 'function f(x){if(x)return 1;else return 2}',
    expected: 'function f(x) {\n  if (x)\n\n    return 1\n  else\n\n    return 2\n}\n'
  },
  {
    name: 'switch case와 중첩 case 블록의 return 간격을 구분한다',
    source: 'function f(x){switch(x){case 1:return 1;default:{return 2}}}',
    expected:
      'function f(x) {\n  switch (x) {\n    case 1:\n\n      return 1\n    default: {\n      return 2\n    }\n  }\n}\n'
  },
  {
    name: 'label 뒤 return 앞에는 빈 줄을 둔다',
    source: 'function f(){done:return 1}',
    expected: 'function f() {\n  done:\n\n  return 1\n}\n'
  },
  {
    name: '블록 첫 return 앞의 한 줄 주석 위치를 유지한다',
    source: 'function f(){\n// reason\nreturn 1}',
    expected: 'function f() {\n  // reason\n  return 1\n}\n'
  },
  {
    name: '블록 첫 return과 같은 줄의 블록 주석을 유지한다',
    source: 'function f(){/* reason */ return 1}',
    expected: 'function f() {\n  /* reason */ return 1\n}\n'
  },
  {
    name: '주석과 블록 첫 return 사이의 빈 줄은 한 줄로 유지한다',
    source: 'function f(){\n/* reason */\n\n\nreturn 1}',
    expected: 'function f() {\n  /* reason */\n\n  return 1\n}\n'
  },
  {
    name: '이전 문장의 줄 끝 주석을 유지하며 return 앞에 빈 줄을 둔다',
    source: 'function f(){work(); // reason\nreturn 1}',
    expected: 'function f() {\n  work() // reason\n\n  return 1\n}\n'
  },
  {
    name: '반환식 안의 주석을 유지한다',
    source: 'function f(){return /* value */ 1}',
    expected: 'function f() {\n  return /* value */ 1\n}\n'
  },
  {
    name: 'ASI로 끝난 bare return 뒤의 개행을 유지한다',
    source: 'function f(){return\n(1)}',
    expected: 'function f() {\n  return\n  1\n}\n'
  },
  {
    name: '템플릿 문자열 안의 return과 공백을 보존한다',
    source: 'function f(){return `line\nreturn value\n\n  return other`}',
    expected: 'function f() {\n  return `line\nreturn value\n\n  return other`\n}\n'
  },
  {
    name: '연속된 블록 guard 사이에 빈 줄을 두고 각 첫 return의 간격을 유지한다',
    source: 'function f(management,phone){if(management){return 1}if(phone){return 2}return 3}',
    expected:
      'function f(management, phone) {\n  if (management) {\n    return 1\n  }\n\n  if (phone) {\n    return 2\n  }\n\n  return 3\n}\n'
  },
  {
    name: '연속된 블록 if 사이의 여러 빈 줄은 한 줄로 수렴한다',
    source: 'function f(a,b){if(a){one()}\n\n\nif(b){two()}}',
    expected: 'function f(a, b) {\n  if (a) {\n    one()\n  }\n\n  if (b) {\n    two()\n  }\n}\n'
  },
  {
    name: 'else if 연결을 유지하며 다음 독립 if 앞에 빈 줄을 둔다',
    source: 'function f(a,b,c){if(a){one()}else if(b){two()}else{three()}if(c){four()}}',
    expected:
      'function f(a, b, c) {\n  if (a) {\n    one()\n  } else if (b) {\n    two()\n  } else {\n    three()\n  }\n\n  if (c) {\n    four()\n  }\n}\n'
  },
  {
    name: '중첩 블록 if는 같은 문장 목록의 if 사이만 분리한다',
    source: 'function f(a,b,c){if(a){if(b){one()}if(c){two()}}if(b){three()}}',
    expected:
      'function f(a, b, c) {\n  if (a) {\n    if (b) {\n      one()\n    }\n\n    if (c) {\n      two()\n    }\n  }\n\n  if (b) {\n    three()\n  }\n}\n'
  },
  {
    name: '최상위의 연속된 블록 if 사이에 빈 줄을 둔다',
    source: 'if(first){one()}if(second){two()}',
    expected: 'if (first) {\n  one()\n}\n\nif (second) {\n  two()\n}\n'
  },
  {
    name: '두 번째 블록 if와 같은 줄의 블록 주석은 한 번의 포맷으로 빈 줄을 만든다',
    source: 'function f(a,b){if(a){one()}\n/* reason */ if(b){two()}}',
    expected:
      'function f(a, b) {\n  if (a) {\n    one()\n  }\n  /* reason */\n\n  if (b) {\n    two()\n  }\n}\n'
  },
  {
    name: '블록 if의 줄 끝 주석 위치를 유지한다',
    source: 'function f(a,b){if(a){one()} // first\nif(b){two()}}',
    expected:
      'function f(a, b) {\n  if (a) {\n    one()\n  } // first\n\n  if (b) {\n    two()\n  }\n}\n'
  }
]

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
  test(`.${extension} 공통 설정은 주석이 있는 연속 블록 if와 이후 return 앞에 빈 줄을 둔다`, async () => {
    const filepath = `fixture.${extension}`
    const input = 'function f(a,b){if(a){return 1}\n/* reason */ if(b){return 2}return 3}'
    const expected =
      'function f(a, b) {\n  if (a) {\n    return 1\n  }\n  /* reason */\n\n  if (b) {\n    return 2\n  }\n\n  return 3\n}\n'
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
  const sources = [
    'function f(){return\n(1)}; f()',
    'function f(){return /* split\nline */ (1)}; f()',
    'function f(){return (\n{value: 1}\n)}; JSON.stringify(f())',
    'let count=0; function next(){count++;return count} function f(){return next() + next()}; [f(), count].join() ',
    'function f(){return `line\nreturn value\n\n  return other`}; f()',
    'function f(){done:return 1}; f()',
    'function f(x){switch(x){case 1:return ++x;default:{return x*2}}}; [f(1),f(3)].join()',
    'function f(){try{return 1}finally{return 2}}; f()'
  ]

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
  const sources = [
    'let trace=[]; function f(a,b){if(a){trace.push("first");return 1}if(b){trace.push("second");return 2}return 3}; [f(true,true),f(false,true),f(false,false),trace.join()].join("|")',
    'let n=0;if(false){n+=1}\n/* reason */\n\nif(true){n+=2};n',
    'let n=0;if(false){n+=1}\n// reason\nif(true){n+=2};n',
    'let n=0;if(false){n+=1}\n/* reason */ if(true){n+=2};n',
    'let n=0;if(true)if(false)n=1;else n=2;n',
    'let values=[];if(true){values.push(1)}\nif(true){(values.push(2))}values.join()',
    'function f(a,b){done:{if(a){return 1}if(b){return 2}}return 3};[f(true,true),f(false,true),f(false,false)].join()',
    'function f(a,b){switch(1){case 1:if(a){return 1}if(b){return 2}break}return 3};[f(true,true),f(false,true),f(false,false)].join()',
    'const text=`line\nif (value) {return value}\n\nreturn other`;let result=[];if(true){result.push(text)}if(false){result.push("other")}result.join()'
  ]

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
  const source =
    'function f() {\n  work()\n  return 1\n}\n\nif (first) {\n  one()\n}\nif (second) {\n  two()\n}\n'
  const expected =
    'function f() {\n  work()\n\n  return 1\n}\n\nif (first) {\n  one()\n}\n\nif (second) {\n  two()\n}\n'

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
