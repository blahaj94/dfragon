import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { packageNotice, resolvePackageRoot } from '@dfragon/licenses/collect'

const libRoot = fileURLToPath(new URL('../', import.meta.url))
const originalNotice = new URL('../../licenses/notices/lib/iconv-lite-LICENSE', import.meta.url)

test('license collection resolves the shared library package root', () => {
  assert.equal(resolvePackageRoot('@dfragon/lib', libRoot), realpathSync(libRoot))
})

test('license collection reads the original notice from the package root', () => {
  const notice = packageNotice(libRoot)
  const document = notice.documents.find(({ name }) => name === 'LICENSES/iconv-lite-LICENSE')

  assert.equal(notice.name, '@dfragon/lib')
  assert.ok(document, 'package root notice must be visible to the license collector')
  assert.equal(document.text, readFileSync(originalNotice, 'utf8'))
})

test('build output preserves the original notice in both distribution locations', () => {
  const original = readFileSync(originalNotice)

  assert.deepEqual(readFileSync(new URL('../LICENSES/iconv-lite-LICENSE', import.meta.url)), original)
  assert.deepEqual(readFileSync(new URL('../dist/notices/iconv-lite-LICENSE', import.meta.url)), original)
})
