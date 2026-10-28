import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lintSamples } from './fixtures/biome-lint.mjs'

const rules = {
  letBranch: 'let과 분기',
  hiddenScreen: 'hidden으로 마운트',
  jsxPropCallback: 'JSX prop 자리',
  absentFirst: '값이 없는 경우를 앞에 둔 삼항'
}

const rejectedCases = [
  [
    rules.letBranch,
    'if, else 대입',
    'export function pick(flag) {\n  let label\n  if (flag) {\n    label = "on"\n  } else {\n    label = "off"\n  }\n\n  return label\n}\n'
  ],
  [
    rules.letBranch,
    '기본값 뒤 if 대입',
    'export function pick(flag) {\n  const prefix = "x"\n  let label = "off"\n  if (flag) {\n    label = "on"\n  }\n\n  return prefix + label\n}\n'
  ],
  [
    rules.letBranch,
    'else if 체인 대입',
    'export function pick(kind, flag) {\n  let label = null\n  if (kind === "a") {\n    label = "A"\n  } else if (flag) {\n    label = "flag"\n  }\n\n  return label\n}\n'
  ],
  [
    rules.letBranch,
    '중괄호 없는 else if 체인 대입',
    'export function pick(kind, flag) {\n  let label\n  if (flag) label = "x"\n  else if (kind === "a") label = "y"\n  else label = "z"\n\n  return label\n}\n'
  ],
  [
    rules.letBranch,
    'switch 대입',
    'export function pick(kind) {\n  let size\n  switch (kind) {\n    case "a":\n      size = 1\n      break\n    default:\n      size = 2\n  }\n\n  return size\n}\n'
  ],
  [
    rules.letBranch,
    '빈 case를 이어 쓴 switch 대입',
    'export function pick(kind) {\n  let size\n  switch (kind) {\n    case "a":\n    case "b":\n      size = 1\n      break\n    default:\n      size = 2\n  }\n\n  return size\n}\n'
  ],
  [
    rules.letBranch,
    '다른 객체의 같은 이름 속성 대입',
    'export function pick(flag, item) {\n  let label = "off"\n  if (flag) {\n    label = item.label\n  }\n\n  return label\n}\n'
  ],
  [
    rules.hiddenScreen,
    '컴포넌트의 hidden 식',
    'export const view = (mode) => <PartyScreen hidden={mode !== "party"} />\n'
  ],
  [
    rules.hiddenScreen,
    '멤버 이름 컴포넌트의 값 없는 hidden',
    'export const view = () => <Screens.Raid hidden>raid</Screens.Raid>\n'
  ],
  [rules.hiddenScreen, '컴포넌트의 값 없는 hidden', 'export const view = () => <Panel hidden />\n'],
  [
    rules.hiddenScreen,
    'HTML 요소의 hidden 식',
    'export const view = (mode) => <section hidden={mode !== "party"}>party</section>\n'
  ],
  [
    rules.jsxPropCallback,
    '화살표 함수',
    'export const view = (run) => <button onClick={() => run()} type="button" />\n'
  ],
  [
    rules.jsxPropCallback,
    'function 식',
    'export const view = (run) => (\n  <button\n    onClick={function () {\n      run()\n    }}\n    type="button"\n  />\n)\n'
  ],
  [
    rules.jsxPropCallback,
    '삼항 앞 분기의 콜백',
    'export const view = (on, run) => <button onClick={on ? () => run() : undefined} type="button" />\n'
  ],
  [
    rules.jsxPropCallback,
    '삼항 뒤 분기의 괄호로 감싼 콜백',
    'export const view = (on, run) => (\n  <button onClick={on ? undefined : (() => run())} type="button" />\n)\n'
  ],
  [
    rules.jsxPropCallback,
    '&& 뒤 콜백',
    'export const view = (on, items) => <List items={items} render={on && ((item) => item)} />\n'
  ],
  [
    rules.jsxPropCallback,
    '객체 리터럴 속성값의 콜백',
    'export const view = (run) => <Menu actions={{ open: () => run() }} />\n'
  ],
  [
    rules.jsxPropCallback,
    '객체 리터럴 메서드',
    'export const view = (run) => (\n  <Menu\n    actions={{\n      open() {\n        run()\n      }\n    }}\n  />\n)\n'
  ],
  [
    rules.jsxPropCallback,
    'callback ref',
    'export const view = () => <div ref={(node) => node?.focus()} />\n'
  ],
  [
    rules.jsxPropCallback,
    'as로 감싼 콜백',
    'export const view = (run) => <button onClick={(() => run()) as Handler} type="button" />\n'
  ],
  [
    rules.jsxPropCallback,
    'satisfies로 감싼 콜백',
    'export const view = (run) => (\n  <button onClick={(() => run()) satisfies Handler} type="button" />\n)\n'
  ],
  [
    rules.jsxPropCallback,
    '배열 리터럴 안의 콜백',
    'export const view = (run) => <Menu actions={[() => run()]} />\n'
  ],
  [
    rules.jsxPropCallback,
    'spread 속성 안의 콜백',
    'export const view = (run) => <button {...{ onClick: () => run() }} type="button" />\n'
  ],
  [
    rules.absentFirst,
    '=== undefined',
    'export const pick = (x, f) => {\n  const value = x === undefined ? undefined : f(x)\n\n  return value\n}\n'
  ],
  [
    rules.absentFirst,
    '== null',
    'export const pick = (x, f) => {\n  const value = x == null ? undefined : f(x)\n\n  return value\n}\n'
  ],
  [
    rules.absentFirst,
    '=== null',
    'export const pick = (y, f) => {\n  const value = y === null ? null : f(y)\n\n  return value\n}\n'
  ],
  [
    rules.absentFirst,
    '왼쪽의 undefined',
    'export const pick = (x, f) => {\n  const value = undefined === x ? "none" : f(x)\n\n  return value\n}\n'
  ],
  [
    rules.absentFirst,
    '괄호로 감싼 조건',
    'export const pick = (y) => {\n  const value = (y == null) ? "" : [y]\n\n  return value\n}\n'
  ],
  [
    rules.absentFirst,
    '속성 접근 값',
    'export const pick = (item) => {\n  const value = item.score === null ? [] : [item.score]\n\n  return value\n}\n'
  ]
]

const allowedCases = [
  [
    '자기 값을 읽는 누적 대입',
    'export function sum(flag, add, next) {\n  let score = 0\n  if (flag) {\n    score = add(score, next)\n  }\n\n  return score\n}\n'
  ],
  [
    '복합 대입',
    'export function count(flag) {\n  let total = 0\n  if (flag) {\n    total += 1\n  }\n\n  return total\n}\n'
  ],
  [
    '분기 안의 다른 문장',
    'export function pick(flag, log) {\n  let current = 0\n  if (flag) {\n    current = 1\n    log(current)\n  }\n\n  return current\n}\n'
  ],
  [
    'let과 분기 사이의 다른 문장',
    'export function pick(flag, log) {\n  let label = "off"\n  log(label)\n  if (flag) {\n    label = "on"\n  }\n\n  return label\n}\n'
  ],
  [
    '여러 변수를 한 번에 선언한 let',
    'export function pick(flag) {\n  let label = "off",\n    size = 0\n  if (flag) {\n    label = "on"\n  }\n\n  return [label, size]\n}\n'
  ],
  [
    '빈 switch',
    'export function pick(kind) {\n  let size = 0\n  switch (kind) {\n  }\n\n  return size\n}\n'
  ],
  [
    '보이는 화면만 그리기',
    'export const view = (mode) => <main>{mode === "party" && <PartyScreen />}</main>\n'
  ],
  [
    'HTML 요소의 값 없는 hidden과 다른 hidden 속성',
    'export const view = (mode) => (\n  <main>\n    <input type="file" hidden />\n    <Icon aria-hidden />\n    <div data-hidden={mode === "raid"} />\n  </main>\n)\n'
  ],
  [
    '이름 있는 handler',
    'export function View({ run }) {\n  const handleClick = () => run()\n\n  return <button onClick={handleClick} type="button" />\n}\n'
  ],
  [
    '이름 있는 handler를 고르는 삼항',
    'export function View({ on, run }) {\n  const handleClick = () => run()\n\n  return <button onClick={on ? handleClick : undefined} type="button" />\n}\n'
  ],
  [
    'prop 값 계산에 넘기는 콜백',
    'export const view = (items) => <List items={items.map((item) => item.trim())} />\n'
  ],
  [
    '객체 리터럴의 이름 있는 handler',
    'export function View({ run }) {\n  const handleOpen = () => run()\n\n  return <Menu actions={{ open: handleOpen }} />\n}\n'
  ],
  [
    'function-as-children',
    'export const view = (items) => <Render items={items}>{(item) => <li>{item}</li>}</Render>\n'
  ],
  [
    '값이 있을 때를 앞에 둔 삼항',
    'export const pick = (x, y, f) => {\n  const first = x !== undefined ? f(x) : undefined\n  const second = y != null ? f(y) : null\n\n  return [first, second]\n}\n'
  ],
  [
    '값을 쓰지 않는 라벨 선택',
    'export const pick = (data) => {\n  const status = data === null ? "unavailable" : "fresh"\n\n  return status\n}\n'
  ],
  [
    'null 비교가 아닌 조건',
    'export const pick = (x, f) => {\n  const first = x === "a" ? 1 : 2\n  const second = !x ? "none" : f(x)\n\n  return [first, second]\n}\n'
  ],
  [
    'typeof 조건',
    'export const pick = (x, f) => {\n  const value = typeof x === "undefined" ? "none" : f(x)\n\n  return value\n}\n'
  ],
  [
    '비교한 값과 이름만 같은 속성',
    'export const pick = (x, item) => {\n  const first = x == null ? "a" : item.x\n  const second = x == null ? "a" : { x: 1 }\n\n  return [first, second]\n}\n'
  ]
]

function samplePath(index) {
  return `apps/desktop/src/frontend/src/criteria-sample-${index}.tsx`
}

async function pluginMessages(sources) {
  const results = await lintSamples(sources)
  const entries = [...results].map(([file, diagnostics]) => {
    const parseErrors = diagnostics.filter((diagnostic) => diagnostic.category === 'parse')
    assert.deepEqual(parseErrors, [], file)

    return [file, diagnostics.filter((diagnostic) => diagnostic.category === 'plugin')]
  })

  return new Map(entries)
}

const cases = [...rejectedCases.map(([, name, source]) => [name, source]), ...allowedCases]
const messages = await pluginMessages(
  Object.fromEntries(cases.map(([, source], index) => [samplePath(index), source]))
)

for (const [index, [expected, name]] of rejectedCases.entries()) {
  test(`거부 - ${name}`, () => {
    const reported = messages.get(samplePath(index))
    assert.equal(reported.length, 1, JSON.stringify(reported))
    assert.ok(reported[0].message.includes(expected), reported[0].message)
  })
}

for (const [offset, [name]] of allowedCases.entries()) {
  test(`허용 - ${name}`, () => {
    assert.deepEqual(messages.get(samplePath(rejectedCases.length + offset)), [])
  })
}

const excludedFiles = [
  'apps/desktop/src/frontend/src/criteria.test.tsx',
  'packages/ui/test/criteria.tsx',
  'apps/desktop/src/frontend/src/fixture/criteria.tsx',
  'apps/desktop/src/frontend/src/testing/criteria.tsx',
  'packages/lib/src/criteria.generated.tsx'
]
const excludedSource = [
  'export function pick(flag, x, f) {',
  '  let label = "off"',
  '  if (flag) {',
  '    label = "on"',
  '  }',
  '  const value = x == null ? undefined : f(x)',
  '',
  '  return <Panel hidden={flag} onClick={() => f(value)}>{label}</Panel>',
  '}',
  ''
].join('\n')
const excludedMessages = await pluginMessages(
  Object.fromEntries(excludedFiles.map((file) => [file, excludedSource]))
)
const productFile = 'packages/ui/src/criteria.tsx'
const productMessages = await pluginMessages({ [productFile]: excludedSource })

test('제품 코드에서는 네 규칙이 모두 보고한다', () => {
  const reported = productMessages.get(productFile).map(({ message }) => message)
  for (const expected of Object.values(rules)) {
    assert.ok(
      reported.some((message) => message.includes(expected)),
      `${expected}: ${reported}`
    )
  }
})

for (const filePath of excludedFiles) {
  test(`${filePath}: 테스트, fixture, 생성물에는 적용하지 않는다`, () => {
    assert.deepEqual(excludedMessages.get(filePath), [])
  })
}
