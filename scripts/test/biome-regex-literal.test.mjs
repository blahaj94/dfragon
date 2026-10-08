import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lintSamples } from './fixtures/biome-lint.mjs'

const sourceExtensions = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']

// 표본을 한 번에 검사하고, 구문 오류 없이 파싱된 파일의 플러그인 진단만 고른다.
async function restrictionMessages(sources) {
  const results = await lintSamples(sources)
  const entries = [...results].map(([file, diagnostics]) => {
    const parseErrors = diagnostics.filter((diagnostic) => diagnostic.category === 'parse')
    assert.deepEqual(parseErrors, [], file)

    return [file, diagnostics.filter((diagnostic) => diagnostic.category === 'plugin')]
  })

  return new Map(entries)
}

function sampleSources(source) {
  const entries = sourceExtensions.map((extension) => {
    return [`scripts/regex-literal-sample.${extension}`, source]
  })

  return Object.fromEntries(entries)
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
  ['조건부 const 초기값', 'const pattern = enabled ? /item/ : fallback'],
  [
    '같은 선언의 다른 초기값 안 정규식',
    'const ITEM_PATTERN = /item/, clean = "item".replace(/item/, "")'
  ],
  [
    'const 초기값 함수 안의 let 초기값',
    'const read = () => { let pattern = /item/; return pattern }'
  ]
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

for (const [name, source] of rejectedCases) {
  const messages = await restrictionMessages(sampleSources(source))

  for (const extension of sourceExtensions) {
    test(`${extension}: 정규식 거부 - ${name}`, () => {
      const restriction = messages.get(`scripts/regex-literal-sample.${extension}`)
      assert.equal(restriction.length, 1, JSON.stringify(restriction))
      assert.ok(restriction[0].message.includes('정규식 리터럴'), restriction[0].message)
    })
  }
}

for (const [name, source] of allowedCases) {
  const messages = await restrictionMessages(sampleSources(source))

  for (const extension of sourceExtensions) {
    test(`${extension}: 정규식 허용 - ${name}`, () => {
      assert.deepEqual(messages.get(`scripts/regex-literal-sample.${extension}`), [])
    })
  }
}

test('export const 초기값의 정규식 리터럴을 허용한다', async () => {
  const file = 'scripts/regex-export.mjs'
  const messages = await restrictionMessages({ [file]: 'export const ITEM_PATTERN = /item/u' })

  assert.deepEqual(messages.get(file), [])
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

const excludedSource = 'assert.match(value, /item/); function pick(value) { return value ?? 0 }'
const excludedMessages = await restrictionMessages(
  Object.fromEntries(excludedFiles.map((file) => [file, excludedSource]))
)

for (const filePath of excludedFiles) {
  test(`${filePath}: 정규식만 제외하고 return 규칙은 유지한다`, () => {
    const messages = excludedMessages.get(filePath)
    assert.equal(messages.length, 1, JSON.stringify(messages))
    assert.ok(messages[0].message.includes('??'), messages[0].message)
  })
}

const buildToolFiles = [
  'apps/desktop/build/regex-sample.ts',
  'apps/desktop/scripts/validate-ocr-model.mjs',
  'apps/web/vite.config.ts',
  'packages/ui/scripts/verify-build.mjs'
]
const buildToolMessages = await restrictionMessages(
  Object.fromEntries(buildToolFiles.map((file) => [file, 'const value = /item/.test("item")']))
)

for (const filePath of buildToolFiles) {
  test(`${filePath}: 직접 관리하는 빌드 도구도 정규식을 검사한다`, () => {
    const messages = buildToolMessages.get(filePath)
    assert.equal(messages.length, 1, JSON.stringify(messages))
    assert.ok(messages[0].message.includes('정규식 리터럴'), messages[0].message)
  })
}

test('기존 생성물과 의존성의 전역 ignore를 유지한다', async () => {
  const checkedFile = 'scripts/regex-checked.mjs'
  const ignoredFiles = [
    'node_modules/sample/index.js',
    'apps/api/dist/main.js',
    'apps/desktop/src/frontend/public/ocr/worker.js',
    'packages/ui/src/seed/components/button.tsx'
  ]
  const source = 'export const valid = /item/.test("item")'
  const files = [checkedFile, ...ignoredFiles]
  const messages = await restrictionMessages(
    Object.fromEntries(files.map((file) => [file, source]))
  )

  assert.equal(messages.get(checkedFile).length, 1, '같은 실행의 검사 대상은 진단을 받아야 한다')
  for (const filePath of ignoredFiles) {
    assert.deepEqual(messages.get(filePath), [], filePath)
  }
})
