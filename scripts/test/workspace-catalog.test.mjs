import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = new URL('../../', import.meta.url)
const workspace = readFileSync(new URL('pnpm-workspace.yaml', root), 'utf8')
const dependencyGroups = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
]
// 부정 패턴(`!`)은 globSync가 지원하지 않아 받지 않는다.
const workspacePackagesListItem = /^ {2}- (?:'([^'!][^']*)'|"([^"!][^"]*)"|([^\s'"!]\S*))$/u

function readWorkspacePackageGlobs(source) {
  const globs = []
  let inPackages = false

  for (const line of source.split(/\r?\n/u)) {
    if (/^\s*(?:#.*)?$/u.test(line)) {
      continue
    }

    if (/^\S/u.test(line)) {
      inPackages = /^packages:/u.test(line)
      continue
    }

    if (!inPackages) {
      continue
    }
    const item = workspacePackagesListItem.exec(line)
    assert.ok(item, `지원하지 않는 packages 구문: ${line}`)
    const [, singleQuotedGlob, doubleQuotedGlob, plainGlob] = item
    const glob = singleQuotedGlob ?? doubleQuotedGlob ?? plainGlob
    globs.push(glob)
  }
  assert.ok(globs.length > 0, 'pnpm-workspace.yaml의 packages 목록이 있어야 한다')

  return globs
}

const workspacePackagePaths = globSync(
  readWorkspacePackageGlobs(workspace).map((pattern) => `${pattern}/package.json`),
  { cwd: fileURLToPath(root) }
).sort()
assert.ok(workspacePackagePaths.length > 0, 'workspace 패키지를 하나 이상 찾아야 한다')
const manifestPaths = ['package.json', ...workspacePackagePaths]
const manifests = manifestPaths.map((path) => {
  const manifest = JSON.parse(readFileSync(new URL(path, root), 'utf8'))

  return { path, manifest }
})
const workspaceNames = new Set(manifests.map(({ manifest }) => manifest.name))

function readCatalogs(source) {
  const catalogs = new Map()
  let section
  let catalog

  for (const line of source.split(/\r?\n/u)) {
    if (/^\s*(?:#.*)?$/u.test(line)) {
      continue
    }

    if (/^\S/u.test(line)) {
      section = /^([^:\s]+):/u.exec(line)?.[1]
      catalog = undefined

      if (section === 'catalog' || section === 'catalogs') {
        assert.match(line, /^catalogs?:[ \t]*(?:#.*)?$/u, 'catalog은 mapping이어야 한다')
      }

      if (section === 'catalog') {
        assert.ok(!catalogs.has(''), '기본 catalog가 중복되면 안 된다')
        catalog = new Map()
        catalogs.set('', catalog)
      }
      continue
    }

    if (section !== 'catalog' && section !== 'catalogs') {
      continue
    }

    const entry = /^( +)(?:'([^']+)'|"([^"]+)"|([^:\s]+)):[ \t]*(.*?)(?:[ \t]+#.*)?$/u.exec(line)
    assert.ok(entry, `지원하지 않는 catalog 구문: ${line}`)
    const [, indent, singleQuotedName, doubleQuotedName, plainName, rawValue] = entry
    const name = singleQuotedName ?? doubleQuotedName ?? plainName
    const value = rawValue.replace(/^(['"])(.*)\1$/u, '$2')

    if (section === 'catalogs' && indent.length === 2) {
      assert.equal(value, '', `catalogs.${name}은 mapping이어야 한다`)
      assert.ok(!catalogs.has(name), `catalogs.${name}이 중복되면 안 된다`)
      catalog = new Map()
      catalogs.set(name, catalog)
      continue
    }
    const dependencyIndent = section === 'catalog' ? 2 : 4
    assert.equal(indent.length, dependencyIndent, `catalog 들여쓰기: ${line}`)
    assert.ok(catalog, `named catalog 없이 선언된 의존성: ${line}`)
    assert.ok(!catalog.has(name), `catalog의 ${name}이 중복되면 안 된다`)
    catalog.set(name, value)
  }
  assert.ok(catalogs.has(''), '기본 catalog가 있어야 한다')

  return catalogs
}

test('모든 workspace의 외부 의존성은 해당 패키지가 등록된 catalog를 참조한다', () => {
  const catalogs = readCatalogs(workspace)
  assert.match(workspace, /^catalogMode: strict[ \t]*(?:#.*)?$/mu)

  for (const { path, manifest } of manifests) {
    for (const group of dependencyGroups) {
      for (const [name, specifier] of Object.entries(manifest[group] ?? {})) {
        const location = `${path} ${group}.${name}`

        if (workspaceNames.has(name)) {
          assert.equal(specifier, 'workspace:*', location)
          continue
        }
        assert.match(specifier, /^catalog:([^\s:]+)?$/u, `${location}은 catalog를 참조해야 한다`)
        const catalogName = specifier.slice('catalog:'.length)
        const catalog = catalogs.get(catalogName)
        assert.ok(catalog?.has(name), `${location}의 ${specifier}에 ${name}이 있어야 한다`)
      }
    }
  }
})

test('기본 catalog와 모든 named catalog는 정확한 버전 또는 npm 별칭만 선언한다', () => {
  const catalogs = readCatalogs(workspace)
  const numericIdentifier = '(?:0|[1-9][0-9]*)'
  const prereleaseIdentifier = `(?:${numericIdentifier}|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)`
  const exactVersion = new RegExp(
    `^(?:npm:(?:@[^/\\s@]+/)?[^/\\s@]+@)?${numericIdentifier}\\.${numericIdentifier}\\.${numericIdentifier}` +
      `(?:-${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*)?(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?$`,
    'u'
  )

  for (const [catalogName, catalog] of catalogs) {
    for (const [name, version] of catalog) {
      assert.match(version, exactVersion, `catalog:${catalogName} ${name}: ${version}`)
    }
  }
})
