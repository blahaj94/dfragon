import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { uiNotices } from '../src/ui-notices.ts'

test('build output includes main-only production notices without listing them as renderer modules', () => {
  const root = mkdtempSync(join(tmpdir(), 'ldb-notices-build-'))
  try {
    writeFileSync(join(root, 'seed-provenance.json'), JSON.stringify({ files: [] }))
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { 'main-only': '1' }, devDependencies: { tool: '1' } })
    )
    for (const name of ['main-only', 'renderer', 'tool']) {
      const directory = join(root, 'node_modules', name)
      mkdirSync(directory, { recursive: true })
      writeFileSync(
        join(directory, 'package.json'),
        JSON.stringify({ name, version: '1.0.0', license: 'MIT' })
      )
      writeFileSync(join(directory, 'LICENSE'), `${name} license text`)
    }
    const assets = new Map<string, string>()
    uiNotices({ uiRoot: root, runtimeRoot: root }).generateBundle.call(
      {
        getModuleIds: () => [join(root, 'node_modules/renderer/index.js')].values(),
        emitFile(asset) {
          assets.set(asset.fileName, asset.source)
          return asset.fileName
        }
      },
      {},
      {}
    )
    const notices = assets.get('notices/THIRD-PARTY.txt')!
    assert.match(notices, /main-only license text/)
    assert.match(notices, /renderer license text/)
    assert.doesNotMatch(notices, /tool license text/)
    const modules = JSON.parse(assets.get('notices/bundle-modules.json')!)
    assert.deepEqual(
      modules.map((entry: { name: string }) => entry.name),
      ['renderer']
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
