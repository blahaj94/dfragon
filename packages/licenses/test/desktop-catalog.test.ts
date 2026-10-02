import assert from 'node:assert/strict'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { collectDesktopCatalog } from '../src/desktop-catalog.ts'
import { desktopLicenseCatalog } from '../src/vite.ts'
import type { NoticeEntry } from '../src/types.ts'
import { createPackageFixture } from './fixtures.ts'

const ocrOriginals = {
  'PaddleOCR-LICENSE.txt': '\ufeff  Paddle fixture original\r\n\r\n',
  'ONNX-Runtime-LICENSE.txt': 'ONNX fixture "original" \\ path\r\n',
  'ONNX-Runtime-ThirdPartyNotices.txt': '  Fixture attribution\n</script>\nUnicode\u2028line  \n'
}

function createCatalogFixture(t: Pick<TestContext, 'after'>) {
  const fixture = createPackageFixture(t)
  fixture.writeManifest('desktop', {})
  fixture.writeManifest('ui', {})
  for (const [name, text] of Object.entries(ocrOriginals)) {
    fixture.writeFile(`ocr/${name}`, text)
  }
  const options = {
    runtimeRoot: join(fixture.root, 'desktop'),
    uiRoot: join(fixture.root, 'ui'),
    ocrRoot: join(fixture.root, 'ocr')
  }

  return { ...fixture, options }
}

function expectedStaticEntries(): NoticeEntry[] {
  const entries: NoticeEntry[] = [
    {
      name: 'SEED Design',
      version: '',
      license: 'Apache-2.0',
      documents: [
        {
          name: 'SEED-NOTICE',
          text: readFileSync(new URL('../notices/ui/SEED-NOTICE', import.meta.url), 'utf8')
        },
        {
          name: 'SEED-LICENSE',
          text: readFileSync(new URL('../notices/ui/SEED-LICENSE', import.meta.url), 'utf8')
        }
      ]
    },
    {
      name: 'Seed Icon',
      version: '',
      license: 'Apache-2.0',
      documents: [
        {
          name: 'ICONS-NOTICE',
          text: readFileSync(new URL('../notices/ui/ICONS-NOTICE', import.meta.url), 'utf8')
        },
        {
          name: 'ICONS-LICENSE',
          text: readFileSync(new URL('../notices/ui/ICONS-LICENSE', import.meta.url), 'utf8')
        }
      ]
    },
    {
      name: 'Lucide',
      version: '',
      license: 'ISC · MIT',
      documents: [
        {
          name: 'LUCIDE-LICENSE',
          text: readFileSync(new URL('../notices/desktop/LUCIDE-LICENSE', import.meta.url), 'utf8')
        }
      ]
    },
    {
      name: 'NanumSquare Neo',
      version: '',
      license: 'OFL-1.1',
      documents: [
        {
          name: 'FONT-LICENSE',
          text: readFileSync(new URL('../notices/desktop/FONT-LICENSE', import.meta.url), 'utf8')
        }
      ]
    },
    {
      name: 'PaddleOCR',
      version: '',
      license: 'Apache-2.0',
      documents: [{ name: 'PaddleOCR-LICENSE.txt', text: ocrOriginals['PaddleOCR-LICENSE.txt'] }]
    },
    {
      name: 'ONNX Runtime',
      version: '',
      license: 'MIT · Third-party notices',
      documents: [
        { name: 'ONNX-Runtime-LICENSE.txt', text: ocrOriginals['ONNX-Runtime-LICENSE.txt'] },
        {
          name: 'ONNX-Runtime-ThirdPartyNotices.txt',
          text: ocrOriginals['ONNX-Runtime-ThirdPartyNotices.txt']
        }
      ]
    }
  ]

  return entries
}

test('실제 UI peer와 앱·UI production의 전이 의존성을 포함하고 다른 개발 도구를 제외한다', async (t) => {
  const fixture = createCatalogFixture(t)
  const uiManifest: { peerDependencies: Record<string, string> } = JSON.parse(
    readFileSync(new URL('../../ui/package.json', import.meta.url), 'utf8')
  )
  const peers = uiManifest.peerDependencies
  fixture.writeManifest('desktop', {
    dependencies: { 'main-runtime': '1' },
    devDependencies: { ...peers, 'build-tool': '1' }
  })
  fixture.writeManifest('ui', {
    dependencies: { 'ui-only': '1' },
    peerDependencies: peers,
    devDependencies: { 'ui-build-tool': '1' }
  })
  const peerOriginals: Record<string, string> = {
    '@seed-design/css': '  SEED CSS fixture original\r\n',
    '@seed-design/react': 'SEED React fixture original\r\n',
    react: 'React fixture original\n',
    'react-dom': 'React DOM fixture original\r\n'
  }
  for (const name of ['@seed-design/css', '@seed-design/react', 'react', 'react-dom']) {
    let dependencies = {}
    if (name === '@seed-design/react') {
      dependencies = { 'peer-child': '1' }
    }

    if (name === 'react-dom') {
      dependencies = { react: peers.react, scheduler: '1' }
    }
    fixture.pkg(name, {
      manifest: { version: peers[name], dependencies },
      documents: { LICENSE: peerOriginals[name] }
    })
  }
  fixture.pkg('main-runtime', {
    manifest: { dependencies: { 'runtime-child': '1', 'shared-runtime': '2' } },
    documents: { LICENSE: 'Main fixture original\r\n' }
  })
  fixture.pkg('runtime-child', { documents: { LICENSE: 'Runtime child fixture original\n' } })
  fixture.pkg('ui-only', {
    manifest: { dependencies: { 'shared-runtime': '2' } },
    documents: { LICENSE: 'UI fixture original\n' }
  })
  fixture.pkg('shared-runtime', {
    manifest: { version: '2.0.0', license: 'BSD-3-Clause' },
    documents: { 'COPYING.txt': '\ufeffShared fixture original\r\n\r\n  attribution  \n' }
  })
  fixture.pkg('peer-child', { documents: { LICENSE: 'Peer child fixture original\n' } })
  fixture.pkg('scheduler', { documents: { LICENSE: 'Scheduler fixture original\n' } })
  fixture.pkg('build-tool', { documents: {} })
  fixture.pkg('ui-build-tool', { documents: {} })
  const expectedPackages: NoticeEntry[] = [
    {
      name: '@seed-design/css',
      version: peers['@seed-design/css'],
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: '  SEED CSS fixture original\r\n' }]
    },
    {
      name: '@seed-design/react',
      version: peers['@seed-design/react'],
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'SEED React fixture original\r\n' }]
    },
    {
      name: 'main-runtime',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'Main fixture original\r\n' }]
    },
    {
      name: 'peer-child',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'Peer child fixture original\n' }]
    },
    {
      name: 'react-dom',
      version: peers['react-dom'],
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'React DOM fixture original\r\n' }]
    },
    {
      name: 'react',
      version: peers.react,
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'React fixture original\n' }]
    },
    {
      name: 'runtime-child',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'Runtime child fixture original\n' }]
    },
    {
      name: 'scheduler',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'Scheduler fixture original\n' }]
    },
    {
      name: 'shared-runtime',
      version: '2.0.0',
      license: 'BSD-3-Clause',
      documents: [
        { name: 'COPYING.txt', text: '\ufeffShared fixture original\r\n\r\n  attribution  \n' }
      ]
    },
    {
      name: 'ui-only',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'UI fixture original\n' }]
    }
  ]
  const expectedCatalog = [...expectedStaticEntries(), ...expectedPackages]

  assert.deepEqual(collectDesktopCatalog(fixture.options), expectedCatalog)
  const plugin = desktopLicenseCatalog(fixture.options)
  const id = plugin.resolveId('virtual:dfragon-desktop-licenses')
  assert.equal(id, '\0virtual:dfragon-desktop-licenses')
  const source = plugin.load(id!)!
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  )
  assert.deepEqual(module.default, expectedCatalog)
  // 가상 모듈은 원문 데이터 하나를 default export로 제공한다.
  assert.deepEqual(Object.keys(module), ['default'])
  assert.equal(source.includes(fixture.root), false)
  assert.equal(plugin.resolveId('unrelated'), null)
  assert.equal(plugin.resolveId('\0virtual:dfragon-desktop-licenses'), null)
  assert.equal(plugin.load('virtual:dfragon-desktop-licenses'), null)
  assert.equal(plugin.load('unrelated'), null)
})

test('알려진 guid-typescript 원문 공백을 catalog에서도 추정 없이 확인 필요 상태로 표시한다', (t) => {
  const fixture = createCatalogFixture(t)
  fixture.writeManifest('desktop', { dependencies: { 'guid-typescript': '1.0.9' } })
  fixture.pkg('guid-typescript', {
    manifest: { version: '1.0.9', license: 'ISC' },
    documents: {}
  })

  assert.deepEqual(collectDesktopCatalog(fixture.options), [
    ...expectedStaticEntries(),
    {
      name: 'guid-typescript',
      version: '1.0.9',
      license: 'ISC · 원문 확인 필요',
      documents: [
        {
          name: 'LICENSE-STATUS.txt',
          text:
            '이 패키지는 npm에서 ISC를 선언하지만 배포 패키지와 현재 공식 저장소에 라이선스 원문이 없습니다. 저작권 문구를 추정하지 않았으며 원문 확보가 필요합니다.\n' +
            'https://www.npmjs.com/package/guid-typescript/v/1.0.9\n' +
            'https://github.com/snico-dev/guid-typescript'
        }
      ]
    }
  ])
})

for (const scope of ['앱 production', 'UI production', 'UI peer'] as const) {
  test(`${scope}의 전이 의존성 원문이 누락되면 virtual catalog 생성을 실패시킨다`, (t) => {
    const fixture = createCatalogFixture(t)
    fixture.pkg('unknown', { documents: {} })
    if (scope === 'UI peer') {
      fixture.writeManifest('ui', { peerDependencies: { react: '19.2.8' } })
      fixture.pkg('react', {
        manifest: { version: '19.2.8', dependencies: { unknown: '1' } }
      })
    } else {
      const manifestRoot = scope === '앱 production' ? 'desktop' : 'ui'
      fixture.writeManifest(manifestRoot, { dependencies: { parent: '1' } })
      fixture.pkg('parent', { manifest: { dependencies: { unknown: '1' } } })
    }
    const plugin = desktopLicenseCatalog(fixture.options)

    assert.throws(() => plugin.load('\0virtual:dfragon-desktop-licenses'), {
      name: 'Error',
      message: 'Missing license text for unknown@1.0.0'
    })
  })
}

test('필수 UI peer를 해석하지 못하면 불완전한 catalog를 반환하지 않는다', (t) => {
  const fixture = createCatalogFixture(t)
  fixture.writeManifest('ui', { peerDependencies: { '@fixture/uninstalled-peer': '1' } })

  assert.throws(() => collectDesktopCatalog(fixture.options), { code: 'MODULE_NOT_FOUND' })
})

test('필수 OCR 원문이 없으면 해당 파일 오류를 전파한다', (t) => {
  const fixture = createCatalogFixture(t)
  const missingOriginal = join(fixture.options.ocrRoot, 'ONNX-Runtime-ThirdPartyNotices.txt')
  rmSync(missingOriginal)

  assert.throws(() => collectDesktopCatalog(fixture.options), {
    code: 'ENOENT',
    path: missingOriginal
  })
})
