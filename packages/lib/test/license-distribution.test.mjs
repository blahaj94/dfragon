import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { collectPackages, packageNotice, resolvePackageRoot } from '@dfragon/licenses/collect'

const libRoot = fileURLToPath(new URL('../', import.meta.url))
const originalNotice = new URL('../../licenses/notices/lib/iconv-lite-LICENSE', import.meta.url)

test('라이선스 수집기는 공개 package.json 경로에서 공용 library의 루트를 찾는다', () => {
  assert.equal(resolvePackageRoot('@dfragon/lib', libRoot), realpathSync(libRoot))
})

test('패키지 루트에서 CP949 문자 표의 고지 원문을 수집한다', () => {
  const notice = packageNotice(libRoot)
  const document = notice.documents.find(({ name }) => name === 'LICENSES/iconv-lite-LICENSE')

  assert.equal(notice.name, '@dfragon/lib')
  assert.ok(document, '패키지 루트의 고지가 라이선스 수집기에 보여야 한다')
  assert.equal(document.text, readFileSync(originalNotice, 'utf8'))
})

test('빌드는 두 배포 위치에 고지 원문의 바이트를 그대로 보존한다', () => {
  const original = readFileSync(originalNotice)

  assert.deepEqual(
    readFileSync(new URL('../LICENSES/iconv-lite-LICENSE', import.meta.url)),
    original
  )
  assert.deepEqual(
    readFileSync(new URL('../dist/notices/iconv-lite-LICENSE', import.meta.url)),
    original
  )
})

test('runtime 의존성이 없어 고지를 하나도 수집하지 않는다', () => {
  const notices = collectPackages([], libRoot)

  assert.deepEqual(
    notices.map(({ name }) => name),
    []
  )
})
