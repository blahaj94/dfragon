import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lintSamples } from './fixtures/biome-lint.mjs'

const policyCategories = new Set(['lint/style/noNestedTernary', 'plugin'])
const sampleFiles = [
  'scripts/return-expression-sample.mjs',
  'apps/api/src/return-expression-sample.ts',
  'scripts/test/return-expression-sample.test.mjs',
  'apps/api/test/return-expression-sample.test.ts',
  'apps/ocr/test-support/return-expression-sample.mjs'
]

// 같은 source를 모든 표본 경로에 두고 Biome를 한 번 실행해 경로별 정책 진단을 고른다.
async function policyMessages(source) {
  const results = await lintSamples(Object.fromEntries(sampleFiles.map((file) => [file, source])))
  const entries = [...results].map(([file, diagnostics]) => {
    return [file, diagnostics.filter((diagnostic) => policyCategories.has(diagnostic.category))]
  })

  return new Map(entries)
}

const rejectedCases = [
  ['return의 삼항', 'export function pick(flag) {\n  return flag ? 1 : 2\n}\n', '삼항'],
  [
    '괄호로 감싼 return의 삼항',
    'export function pick(flag) {\n  return (flag ? 1 : 2)\n}\n',
    '삼항'
  ],
  ['return의 ??', 'export function pick(value) {\n  return value ?? 0\n}\n', '??'],
  ['괄호로 감싼 return의 ??', 'export function pick(value) {\n  return (value ?? 0)\n}\n', '??'],
  [
    '괄호로 감싼 반환 객체의 조건식 속성',
    'export function pick(flag) {\n  return ({ value: flag ? 1 : 2 })\n}\n',
    '지역 변수'
  ],
  [
    '괄호로 감싼 조건식 속성값',
    'export function pick(flag) {\n  return { value: (flag ? 1 : 2) }\n}\n',
    '지역 변수'
  ],
  [
    '반환 객체의 조건식 속성',
    'export function pick(flag) {\n  return { value: flag ? 1 : 2 }\n}\n',
    '지역 변수'
  ],
  [
    '반환 객체의 논리식 속성',
    'export function pick(value) {\n  return { value: value || 0 }\n}\n',
    '지역 변수'
  ],
  [
    '중첩 삼항',
    'export const value = (a, b) => {\n  const picked = a ? 1 : b ? 2 : 3\n\n  return picked\n}\n',
    'Do not nest'
  ]
]

const allowedCases = [
  [
    '변수 할당의 단일 삼항',
    'export function pick(flag) {\n  const value = flag ? 1 : 2\n\n  return value\n}\n'
  ],
  ['불리언 판정식 반환', 'export function isEmpty(a, b) {\n  return a == null || b === ""\n}\n'],
  [
    '미리 할당한 변수로 만든 반환 객체',
    'export function pick(value) {\n  const amount = value ?? 0\n\n  return { amount }\n}\n'
  ],
  [
    'return 밖의 조건식',
    'export function pick(flag, run) {\n  run(flag ? 1 : 2)\n\n  return flag\n}\n'
  ]
]

for (const [name, source, expected] of rejectedCases) {
  const messages = await policyMessages(source)

  for (const filePath of sampleFiles) {
    test(`${filePath}: 거부 - ${name}`, () => {
      const policy = messages.get(filePath)

      assert.equal(policy.length, 1, JSON.stringify(policy))
      assert.ok(policy[0].message.includes(expected), policy[0].message)
    })
  }
}

for (const [name, source] of allowedCases) {
  const messages = await policyMessages(source)

  for (const filePath of sampleFiles) {
    test(`${filePath}: 허용 - ${name}`, () => {
      assert.deepEqual(messages.get(filePath), [])
    })
  }
}

test('반환 객체의 직접 속성 조건식을 첫 위반에서 멈추지 않고 모두 보고한다', async () => {
  const line =
    '  return { first: flag ? 1 : 2, second: value || 0, third: { nested: flag ? 1 : 2 } }'
  const source = `export function pick(flag, value) {\n${line}\n}\n`
  const messages = await policyMessages(source)
  const reported = messages.get(sampleFiles[0]).map(({ location }) => {
    return line.slice(location.start.column - 1, location.end.column - 1)
  })

  assert.deepEqual(reported, ['flag ? 1 : 2', 'value || 0'])
})
