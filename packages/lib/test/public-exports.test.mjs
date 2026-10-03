import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const consumer = new URL('./fixtures/public-consumer.ts', import.meta.url)

test('공개 package 경로를 Node와 strict TypeScript 소비자가 앱별 타입 없이 사용한다', async () => {
  const program = ts.createProgram([fileURLToPath(consumer)], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    lib: ['lib.es2022.d.ts'],
    types: [],
    strict: true,
    noEmit: true,
    resolveJsonModule: true
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  const errors = diagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  )

  assert.deepEqual(errors, [], '빌드된 공개 타입을 소비하는 사례에 컴파일 오류가 없어야 한다')

  // Node의 type stripping은 타입 검사와 별도로 모든 named runtime import를 해석한다.
  const api = await import(consumer.href)
  assert.equal(api.packageName, '@dfragon/lib')
  assert.equal(api.nicknameMessage('★검신★', { bannedWords: [] }), null)
  assert.equal(
    api.nicknameMessage('MyGM', { bannedWords: ['gm'] }),
    '사용할 수 없는 단어가 포함되어 있습니다.'
  )
})

test('OCR 공개 계약을 소비하는 슬롯 목록은 공대 12행과 기존 4슬롯을 구분한다', async () => {
  const { collectableSlots } = await import(consumer.href)

  assert.deepEqual(collectableSlots('hud'), [1, 2, 3, 4])
  assert.deepEqual(collectableSlots('participants'), [1, 2, 3, 4])
  assert.deepEqual(collectableSlots('raid'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
})
