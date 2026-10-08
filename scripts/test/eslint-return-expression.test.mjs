import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

const root = fileURLToPath(new URL('../../', import.meta.url))
const eslint = new ESLint({ cwd: root })
const policyRules = new Set(['no-nested-ternary', 'no-restricted-syntax'])
const sampleFiles = [
  'scripts/return-expression-sample.mjs',
  'apps/api/src/return-expression-sample.ts',
  'scripts/test/return-expression-sample.test.mjs',
  'apps/api/test/return-expression-sample.test.ts',
  'apps/ocr/test-support/return-expression-sample.mjs'
]

async function policyMessages(source, filePath) {
  const [result] = await eslint.lintText(source, { filePath })

  return result.messages.filter((message) => policyRules.has(message.ruleId))
}

const rejectedCases = [
  ['return의 삼항', 'export function pick(flag) {\n  return flag ? 1 : 2\n}\n', '삼항'],
  ['return의 ??', 'export function pick(value) {\n  return value ?? 0\n}\n', '??'],
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

for (const filePath of sampleFiles) {
  for (const [name, source, expected] of rejectedCases) {
    test(`${filePath}: 거부 - ${name}`, async () => {
      const messages = await policyMessages(source, filePath)

      assert.equal(messages.length, 1, JSON.stringify(messages))
      assert.ok(messages[0].message.includes(expected), messages[0].message)
    })
  }

  for (const [name, source] of allowedCases) {
    test(`${filePath}: 허용 - ${name}`, async () => {
      assert.deepEqual(await policyMessages(source, filePath), [])
    })
  }
}
