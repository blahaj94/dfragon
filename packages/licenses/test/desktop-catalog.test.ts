import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { collectDesktopCatalog, desktopLicenseCatalog } from '../src/desktop-catalog.ts'

test('offline catalog preserves originals, UI peers and production dependencies, excluding development tools', () => {
  const root = mkdtempSync(join(tmpdir(), 'ldb-catalog-'))
  try {
    const uiRoot = join(root, 'ui')
    const ocrRoot = join(root, 'ocr')
    mkdirSync(uiRoot)
    mkdirSync(ocrRoot)
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { runtime: '1' }, devDependencies: { tool: '1' } })
    )
    writeFileSync(join(uiRoot, 'package.json'), JSON.stringify({ peerDependencies: { peer: '1' } }))
    for (const name of ['runtime', 'peer', 'tool']) {
      const directory = join(root, 'node_modules', name)
      mkdirSync(directory, { recursive: true })
      writeFileSync(
        join(directory, 'package.json'),
        JSON.stringify({ name, version: '1', license: 'MIT' })
      )
      writeFileSync(join(directory, 'LICENSE'), `${name}\r\noriginal copyright`)
    }
    for (const name of [
      'PaddleOCR-LICENSE.txt',
      'ONNX-Runtime-LICENSE.txt',
      'ONNX-Runtime-ThirdPartyNotices.txt'
    ]) {
      writeFileSync(join(ocrRoot, name), `Original ${name}`)
    }
    const options = { runtimeRoot: root, uiRoot, ocrRoot }
    const entries = collectDesktopCatalog(options)
    assert.equal(
      entries.find((entry) => entry.name === 'peer')?.documents[0].text,
      'peer\r\noriginal copyright'
    )
    assert(entries.some((entry) => entry.name === 'runtime'))
    assert(!entries.some((entry) => entry.name === 'tool'))
    assert.equal(
      entries.find((entry) => entry.name === 'SEED Design')?.documents[0].text,
      readFileSync(new URL('../notices/ui/SEED-NOTICE', import.meta.url), 'utf8')
    )
    assert.equal(entries.find((entry) => entry.name === 'ONNX Runtime')?.documents.length, 2)
    const plugin = desktopLicenseCatalog(options)
    const id = plugin.resolveId('virtual:ldb-desktop-licenses')!
    const source = plugin.load(id)!
    assert.deepEqual(JSON.parse(source.slice('export default '.length, -1)), entries)
    assert.equal(plugin.load('unrelated'), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
