import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

const root = fileURLToPath(new URL('../../', import.meta.url))
const eslint = new ESLint({ cwd: root })
const sourceExtensions = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']

async function restrictionMessages(source, filePath) {
  const [result] = await eslint.lintText(source, { filePath })
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages))

  return result.messages.filter((message) => message.ruleId === 'no-restricted-syntax')
}

const rejectedCases = [
  ['test 호출', 'const valid = /item/.test("item")'],
  ['exec 호출', 'const match = /item/g.exec("item")'],
  ['replace 인자', 'const clean = "item".replace(/item/g, "")'],
  ['객체 속성', 'const options = { pattern: /item/ }'],
  ['배열 원소', 'const patterns = [/item/]'],
  ['let 초기값', 'let pattern = /item/'],
  ['var 초기값', 'var pattern = /item/'],
  ['나중 대입', 'let pattern; pattern = /item/'],
  ['함수 반환', 'function pattern() { return /item/ }'],
  ['매개변수 기본값', 'function match(pattern = /item/) { return pattern }'],
  ['조건부 const 초기값', 'const pattern = enabled ? /item/ : fallback']
]
const allowedCases = [
  ['모듈 const', 'const ITEM_PATTERN = /item/i'],
  [
    '함수 안 상태 의존 const',
    'function matches(value) { const ITEM_PATTERN = /item/gy; return ITEM_PATTERN.test(value) }'
  ],
  [
    '이름 있는 const 사용',
    'const ITEM_PATTERN = /item/g; const value = "item".replace(ITEM_PATTERN, "")'
  ],
  ['괄호로 감싼 const 초기값', 'const ITEM_PATTERN = (/item/)'],
  ['RegExp 문자열 인자', 'const pattern = new RegExp("item", "g")']
]

for (const extension of sourceExtensions) {
  const filePath = `scripts/regex-literal-sample.${extension}`
  for (const [name, source] of rejectedCases) {
    test(`${extension}: 정규식 거부 - ${name}`, async () => {
      const messages = await restrictionMessages(source, filePath)
      assert.equal(messages.length, 1, JSON.stringify(messages))
      assert.ok(messages[0].message.includes('정규식 리터럴'), messages[0].message)
    })
  }
  for (const [name, source] of allowedCases) {
    test(`${extension}: 정규식 허용 - ${name}`, async () => {
      assert.deepEqual(await restrictionMessages(source, filePath), [])
    })
  }
}

test('export const 초기값의 정규식 리터럴을 허용한다', async () => {
  assert.deepEqual(
    await restrictionMessages('export const ITEM_PATTERN = /item/u', 'scripts/regex-export.mjs'),
    []
  )
})

const excludedFiles = [
  'apps/desktop/src/backend/regex.test.ts',
  'apps/ocr/browser/regex.spec.tsx',
  'apps/api/test/regex.ts',
  'apps/api/tests/regex.ts',
  'packages/ui/src/__tests__/regex.ts',
  'scripts/test/fixtures/regex.mjs',
  'apps/desktop/src/frontend/src/fixture/regex.ts',
  'apps/desktop/src/frontend/src/testing/regex.ts',
  'apps/desktop/scripts/windows-crash-fixture/native.fixture.ts',
  'apps/desktop/scripts/auth-bridge-fixture/main.ts',
  'apps/desktop/scripts/auth-bridge-fixture.config.ts',
  'apps/desktop/scripts/credential-store-native/main.ts',
  'apps/desktop/scripts/credential-store-native.mjs',
  'apps/desktop/scripts/search-server-integration/runtime.mjs',
  'apps/accounts/test-support/account-http-fixtures.mjs',
  'apps/ocr/test-support/ui-smoke.mjs',
  'packages/ui/scripts/test-consumer-resolution.mjs',
  'packages/lib/generated/regex.ts',
  'packages/lib/vendor/regex.ts',
  'packages/lib/src/regex.generated.ts'
]

for (const filePath of excludedFiles) {
  test(`${filePath}: 정규식만 제외하고 return 규칙은 유지한다`, async () => {
    const source = 'assert.match(value, /item/); function pick(value) { return value ?? 0 }'
    const messages = await restrictionMessages(source, filePath)
    assert.equal(messages.length, 1, JSON.stringify(messages))
    assert.ok(messages[0].message.includes('??'), messages[0].message)
  })
}

for (const filePath of [
  'apps/desktop/build/regex-sample.ts',
  'apps/desktop/scripts/validate-ocr-model.mjs',
  'apps/web/vite.config.ts',
  'packages/ui/scripts/verify-build.mjs'
]) {
  test(`${filePath}: 직접 관리하는 빌드 도구도 정규식을 검사한다`, async () => {
    const messages = await restrictionMessages('const value = /item/.test("item")', filePath)
    assert.equal(messages.length, 1, JSON.stringify(messages))
    assert.ok(messages[0].message.includes('정규식 리터럴'), messages[0].message)
  })
}

test('기존 생성물과 의존성의 전역 ignore를 유지한다', async () => {
  for (const filePath of [
    'node_modules/sample/index.js',
    'apps/api/dist/main.js',
    'apps/desktop/src/frontend/public/ocr/worker.js',
    'packages/ui/src/seed/components/button.tsx'
  ]) {
    assert.equal(await eslint.isPathIgnored(filePath), true, filePath)
  }
})
