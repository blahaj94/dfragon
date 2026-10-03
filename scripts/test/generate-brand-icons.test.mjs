import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { createIconFixture } from './fixtures/icons/repository.mjs'

const outputs = [
  ['apps/desktop/build/icon.ico', 'ico/icon.ico'],
  ['apps/desktop/build/icon.icns', 'icns/icon.icns'],
  ['apps/desktop/build/icon.png', 'set/512x512.png'],
  ['apps/desktop/resources/icon.png', 'set/512x512.png'],
  ['apps/desktop/resources/brand.png', 'set/128x128.png'],
  ['apps/accounts/browser/icon.png', 'set/128x128.png'],
  ['apps/web/public/favicon.png', 'set/64x64.png']
]

test('변환한 형식과 크기를 각 앱 경로에 복사하고 임시 디렉터리를 정리한다', (t) => {
  const { root, temporary, cwd, run } = createIconFixture(
    t,
    outputs.map(([path]) => path)
  )
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  for (const [path, expected] of outputs) {
    assert.equal(readFileSync(join(root, path), 'utf8'), expected, path)
  }
  assert.deepEqual(readdirSync(temporary), ['unrelated.txt'])
  assert.equal(readFileSync(join(temporary, 'unrelated.txt'), 'utf8'), '다른 작업의 임시 파일')
  assert.deepEqual(readdirSync(cwd), [])
})

test('일부 형식 변환 뒤 실패하면 기존 아이콘을 보존하고 임시 결과를 정리한다', (t) => {
  const { root, temporary, run } = createIconFixture(
    t,
    outputs.map(([path]) => path)
  )
  const result = run({ ICON_FAIL_FORMAT: 'icns' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /합성 변환 실패/)
  for (const [path] of outputs) {
    assert.equal(readFileSync(join(root, path), 'utf8'), '기존 아이콘', path)
  }
  assert.deepEqual(readdirSync(temporary), ['unrelated.txt'])
  assert.equal(readFileSync(join(temporary, 'unrelated.txt'), 'utf8'), '다른 작업의 임시 파일')
})

test('대상 파일 복사 실패도 실패 코드로 전파하고 임시 변환 결과를 정리한다', (t) => {
  const { root, temporary, run } = createIconFixture(
    t,
    outputs.map(([path]) => path)
  )
  const blockedTarget = join(root, 'apps/desktop/build/icon.ico')
  rmSync(blockedTarget)
  mkdirSync(blockedTarget)
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /EISDIR/)
  assert.deepEqual(readdirSync(blockedTarget), [])
  assert.deepEqual(readdirSync(temporary), ['unrelated.txt'])
  assert.equal(readFileSync(join(temporary, 'unrelated.txt'), 'utf8'), '다른 작업의 임시 파일')
})
