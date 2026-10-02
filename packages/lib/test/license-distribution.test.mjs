import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
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

test('요청 제한 runtime 의존성의 고지는 수집하고 문자 표 생성용 codec은 제외한다', () => {
  const notices = collectPackages([], libRoot)
  const ipAddress = notices.find(({ name }) => name === 'ipaddr.js')
  const ipAddressRoot = resolvePackageRoot('ipaddr.js', libRoot)
  const document = ipAddress?.documents.find(({ name }) => name === 'LICENSE')

  assert.ok(document, 'runtime으로 소비하는 ipaddr.js의 원문이 포함되어야 한다')
  assert.equal(document.text, readFileSync(join(ipAddressRoot, 'LICENSE'), 'utf8'))
  assert.equal(
    notices.some(({ name }) => name === 'iconv-lite'),
    false
  )
  assert.equal(
    notices.some(({ name }) => name === '@dfragon/licenses'),
    false
  )
})
