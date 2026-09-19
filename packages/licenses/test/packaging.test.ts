import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { packageDesktopNotices } from '../src/packaging.mjs'

test('packaged viewer uses target Electron notices without modifying shared build output', () => {
  const root = mkdtempSync(join(tmpdir(), 'ldb-package-notices-'))
  try {
    const source = join(root, 'source'),
      electron = join(root, 'target'),
      resources = join(electron, 'resources')
    mkdirSync(source)
    mkdirSync(electron)
    const entries = [
      {
        name: 'Electron',
        version: '39',
        license: 'MIT',
        documents: [{ name: 'LICENSE', text: 'Host original' }]
      }
    ]
    writeFileSync(join(source, 'licenses.json'), JSON.stringify(entries))
    writeFileSync(join(source, 'LICENSES.chromium.html'), 'Host Chromium')
    writeFileSync(join(electron, 'LICENSE.electron.txt'), 'Target Electron')
    writeFileSync(join(electron, 'LICENSES.chromium.html'), 'Target Chromium')
    packageDesktopNotices({
      sourceDirectory: source,
      electronDirectory: electron,
      resourcesDirectory: resources
    })
    assert.equal(
      readFileSync(join(resources, 'licenses/LICENSES.chromium.html'), 'utf8'),
      'Target Chromium'
    )
    assert.match(readFileSync(join(resources, 'licenses/index.html'), 'utf8'), /Target Electron/)
    assert.match(readFileSync(join(source, 'licenses.json'), 'utf8'), /Host original/)
    assert.equal(readFileSync(join(source, 'LICENSES.chromium.html'), 'utf8'), 'Host Chromium')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
