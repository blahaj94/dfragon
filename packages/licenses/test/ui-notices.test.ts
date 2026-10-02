import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { uiNotices } from '../src/vite.ts'
import { createPackageFixture } from './fixtures.ts'

function buildNotices(
  options: Parameters<typeof uiNotices>[0],
  moduleIds: string[] = [],
  bundle: Parameters<ReturnType<typeof uiNotices>['generateBundle']>[1] = {}
) {
  const assets = new Map<string, string>()
  uiNotices(options).generateBundle.call(
    {
      getModuleIds: () => moduleIds.values(),
      emitFile(asset) {
        assets.set(asset.fileName, asset.source)

        return asset.fileName
      }
    },
    {},
    bundle
  )

  return assets
}

test('앱의 production 전이 고지와 번들 고지를 합치되 main 전용 의존성을 renderer 입력에 넣지 않는다', (t) => {
  const fixture = createPackageFixture(t)
  fixture.writeFile('ui/seed-provenance.json', '{ "files": [] }\n')
  fixture.writeManifest('desktop', {
    dependencies: { 'main-only': '1' },
    devDependencies: { tool: '1' }
  })
  fixture.pkg('main-only', {
    manifest: { dependencies: { 'runtime-child': '1' } },
    documents: { LICENSE: 'Main original\r\nCopyright 2026 Fixture owner\r\n' }
  })
  fixture.pkg('runtime-child', {
    documents: { 'COPYING.txt': '\ufeff  Runtime child\r\n\r\n  original attribution  \n' }
  })
  const renderer = fixture.pkg('renderer', {
    documents: {
      LICENSE: 'Renderer original\r\n',
      'NOTICE.txt': '  Renderer attribution\n'
    }
  })
  fixture.writeFile('node_modules/renderer/feature.js', '')
  fixture.pkg('tool', { documents: {} })
  const localModule = fixture.writeFile('desktop/src/index.ts', '')
  const assets = buildNotices(
    { uiRoot: join(fixture.root, 'ui'), runtimeRoot: join(fixture.root, 'desktop') },
    [
      join(renderer, 'index.js?commonjs-proxy'),
      join(renderer, 'feature.js'),
      `\0${join(fixture.root, 'node_modules/tool/index.js')}`,
      localModule
    ]
  )

  assert.equal(
    assets.get('notices/THIRD-PARTY.txt'),
    'main-only@1.0.0 (MIT)\n\n' +
      'LICENSE\nMain original\r\nCopyright 2026 Fixture owner\r\n\n\n' +
      'renderer@1.0.0 (MIT)\n\n' +
      'LICENSE\nRenderer original\r\n\n\n' +
      'NOTICE.txt\n  Renderer attribution\n\n\n' +
      'runtime-child@1.0.0 (MIT)\n\n' +
      'COPYING.txt\n\ufeff  Runtime child\r\n\r\n  original attribution  \n'
  )
  assert.deepEqual(JSON.parse(assets.get('notices/bundle-modules.json')!), [
    {
      name: 'renderer',
      version: '1.0.0',
      license: 'MIT',
      modules: ['index.js', 'feature.js']
    }
  ])
  assert.equal(assets.get('notices/THIRD-PARTY.txt')!.includes(fixture.root), false)
})

test('runtimeRoot가 없는 UI·Web 빌드는 번들 입력의 고지만 수집한다', (t) => {
  const fixture = createPackageFixture(t)
  fixture.writeFile('seed-provenance.json', JSON.stringify({ files: [] }))
  fixture.writeManifest('', { dependencies: { 'unbundled-production': '1' } })
  fixture.pkg('unbundled-production', { documents: {} })
  const renderer = fixture.pkg('renderer', { documents: { LICENSE: 'Renderer original\n' } })

  const assets = buildNotices({ uiRoot: fixture.root }, [join(renderer, 'index.js')])

  assert.equal(
    assets.get('notices/THIRD-PARTY.txt'),
    'renderer@1.0.0 (MIT)\n\nLICENSE\nRenderer original\n'
  )
})

test('SEED 수정 기록·provenance 원문·정적 고지를 보존하고 JavaScript chunk에만 변경 배너를 붙인다', (t) => {
  const fixture = createPackageFixture(t)
  const provenance =
    '{\n  "files": [\n' +
    '    { "local": "src/seed/modified.tsx", "localChanges": ["DFRAGON 수정", "접근성 표시"] },\n' +
    '    { "local": "src/seed/original.tsx", "localChanges": [] }\n' +
    '  ]\n}\n'
  fixture.writeFile('seed-provenance.json', provenance)
  const bundle = {
    'app.js': { type: 'chunk' as const, code: 'export const app = 1\n' },
    'lazy.js': { type: 'chunk' as const, code: 'export const lazy = 2\n' },
    'style.css': { type: 'asset' as const, source: 'body { color: red; }\n' },
    'placeholder.js': { type: 'chunk' as const }
  }

  const assets = buildNotices({ uiRoot: fixture.root }, [], bundle)

  assert.equal(assets.get('notices/seed-provenance.json'), provenance)
  assert.equal(
    assets.get('notices/DFRAGON-MODIFICATIONS.txt'),
    'src/seed/modified.tsx:\n[\n  "DFRAGON 수정",\n  "접근성 표시"\n]'
  )
  const banner =
    '/*! DFRAGON modified SEED source: see notices/DFRAGON-MODIFICATIONS.txt and notices/seed-provenance.json. */\n'
  assert.equal(bundle['app.js'].code, banner + 'export const app = 1\n')
  assert.equal(bundle['lazy.js'].code, banner + 'export const lazy = 2\n')
  assert.equal(bundle['style.css'].source, 'body { color: red; }\n')
  assert.deepEqual(bundle['placeholder.js'], { type: 'chunk' })
  assert.deepEqual(JSON.parse(assets.get('notices/bundle-files.json')!), ['app.js', 'lazy.js'])
  assert.equal(assets.get('notices/THIRD-PARTY.txt'), '')
  assert.deepEqual(JSON.parse(assets.get('notices/bundle-modules.json')!), [])
  assert.deepEqual([...assets.keys()].sort(), [
    'notices/DFRAGON-MODIFICATIONS.txt',
    'notices/ICONS-LICENSE',
    'notices/ICONS-NOTICE',
    'notices/SEED-LICENSE',
    'notices/SEED-NOTICE',
    'notices/THIRD-PARTY.txt',
    'notices/bundle-files.json',
    'notices/bundle-modules.json',
    'notices/seed-provenance.json'
  ])
  for (const name of ['ICONS-LICENSE', 'ICONS-NOTICE', 'SEED-LICENSE', 'SEED-NOTICE']) {
    assert.equal(
      assets.get(`notices/${name}`),
      readFileSync(new URL(`../notices/ui/${name}`, import.meta.url), 'utf8'),
      name
    )
  }
})

test('알려진 원문 공백은 THIRD-PARTY에서도 확인 필요 표시와 근거를 유지한다', (t) => {
  const fixture = createPackageFixture(t)
  fixture.writeFile('seed-provenance.json', JSON.stringify({ files: [] }))
  fixture.writeManifest('', { dependencies: { 'guid-typescript': '1.0.9' } })
  fixture.pkg('guid-typescript', {
    manifest: { version: '1.0.9', license: 'ISC' },
    documents: {}
  })

  const assets = buildNotices({ uiRoot: fixture.root, runtimeRoot: fixture.root })

  assert.equal(
    assets.get('notices/THIRD-PARTY.txt'),
    'guid-typescript@1.0.9 (ISC · 원문 확인 필요)\n\n' +
      'LICENSE-STATUS.txt\n' +
      '이 패키지는 npm에서 ISC를 선언하지만 배포 패키지와 현재 공식 저장소에 라이선스 원문이 없습니다. 저작권 문구를 추정하지 않았으며 원문 확보가 필요합니다.\n' +
      'https://www.npmjs.com/package/guid-typescript/v/1.0.9\n' +
      'https://github.com/snico-dev/guid-typescript'
  )
})

for (const scope of ['번들 입력', '앱 production 의존성'] as const) {
  test(`${scope}의 원문이 누락되면 THIRD-PARTY 산출 성공으로 처리하지 않는다`, (t) => {
    const fixture = createPackageFixture(t)
    fixture.writeFile('seed-provenance.json', JSON.stringify({ files: [] }))
    const unknown = fixture.pkg('unknown', { documents: {} })
    const options: Parameters<typeof uiNotices>[0] = { uiRoot: fixture.root }
    let moduleIds: string[] = []
    if (scope === '번들 입력') {
      moduleIds = [join(unknown, 'index.js')]
    } else {
      fixture.writeManifest('', { dependencies: { unknown: '1' } })
      options.runtimeRoot = fixture.root
    }

    assert.throws(() => buildNotices(options, moduleIds), {
      name: 'Error',
      message: 'Missing license text for unknown@1.0.0'
    })
  })
}
