import assert from 'node:assert/strict'
import { realpathSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  collectPackages,
  findPackageRoot,
  packageNotice,
  resolvePackageRoot
} from '../src/collect.ts'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ldb-notices-test-'))
  function pkg(name: string, manifest: object = {}, license = 'License text') {
    const path = join(root, 'node_modules', name)
    mkdirSync(path, { recursive: true })
    writeFileSync(
      join(path, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', license: 'MIT', main: 'index.js', ...manifest })
    )
    writeFileSync(join(path, 'index.js'), '')
    if (license) {
      writeFileSync(join(path, 'LICENSE'), license)
    }
    return path
  }
  return { root, pkg }
}

test('collects bundled and transitive production dependencies, ignores development-only and absent optional packages', () => {
  const { root, pkg } = fixture()
  try {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        dependencies: { runtime: '1' },
        devDependencies: { tool: '1' },
        optionalDependencies: { absent: '1' }
      })
    )
    pkg('runtime', { dependencies: { nested: '1' } })
    pkg('nested', { dependencies: { runtime: '1' } })
    pkg('tool')
    const bundled = pkg('renderer')
    const entries = collectPackages([join(bundled, 'index.js'), join(bundled, 'index.js')], root)
    assert.deepEqual(
      entries.map((entry) => entry.name),
      ['nested', 'renderer', 'runtime']
    )
    assert.ok(entries.every((entry) => entry.documents[0].text === 'License text'))
    assert.equal(JSON.stringify(entries).includes(root), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('nested ESM package metadata does not hide the owner; nested notices are retained', () => {
  const { root, pkg } = fixture()
  try {
    const directory = pkg('example')
    mkdirSync(join(directory, 'esm'))
    writeFileSync(join(directory, 'esm/package.json'), JSON.stringify({ type: 'module' }))
    mkdirSync(join(directory, 'licenses'))
    writeFileSync(join(directory, 'licenses/third-party.txt'), 'Additional attribution')
    assert.equal(findPackageRoot(join(directory, 'esm/index.js')), realpathSync(directory))
    assert.ok(
      packageNotice(directory).documents.some(
        (document) => document.text === 'Additional attribution'
      )
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('wildcard exports resolving package.json into a missing file use the entry point owner', () => {
  const { root, pkg } = fixture()
  try {
    const directory = pkg('wildcard', { exports: { '.': './index.js', './*': './lib/*' } })
    assert.equal(resolvePackageRoot('wildcard', root), realpathSync(directory))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('unknown missing license is a build error, rather than silently dropping attribution', () => {
  const { root, pkg } = fixture()
  try {
    assert.throws(
      () => packageNotice(pkg('unknown', {}, '')),
      /Missing license text for unknown@1.0.0/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('version-specific upstream originals fill gaps, while the known missing original stays explicit', () => {
  const { root, pkg } = fixture()
  try {
    const stylex = pkg('@stylexjs/stylex', { version: '0.19.0' }, '')
    assert.ok(
      packageNotice(stylex).documents.some((document) => document.text.includes('Meta Platforms'))
    )
    assert.throws(
      () => packageNotice(pkg('@stylexjs/stylex', { version: '99.0.0' }, '')),
      /Missing license text/
    )
    const guid = packageNotice(pkg('guid-typescript', { version: '1.0.9', license: 'ISC' }, ''))
    assert.match(guid.license, /원문 확인 필요/)
    assert.match(guid.documents[0].text, /원문 확보가 필요/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
