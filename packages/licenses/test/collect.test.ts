import assert from 'node:assert/strict'
import { readFileSync, realpathSync, symlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import {
  collectPackages,
  findPackageRoot,
  packageNotice,
  resolvePackageRoot
} from '../src/collect.ts'
import { createPackageFixture } from './fixtures.ts'

const fixtureLicense = 'Fixture license text\r\n'

test('번들 입력과 production 전이, 순환 의존성을 한 번씩 수집하고 개발 도구를 제외한다', (t) => {
  const { root, pkg, writeManifest } = createPackageFixture(t)
  writeManifest('', {
    dependencies: { runtime: '1' },
    devDependencies: { tool: '1' },
    optionalDependencies: { absent: '1', optional: '1' }
  })
  pkg('runtime', {
    manifest: { dependencies: { nested: '1' }, devDependencies: { 'nested-tool': '1' } },
    documents: { LICENSE: 'Runtime fixture\r\n' }
  })
  pkg('nested', {
    manifest: { dependencies: { runtime: '1' } },
    documents: { LICENSE: 'Nested fixture\n' }
  })
  pkg('optional', { documents: { LICENSE: 'Optional fixture\n' } })
  // 원문이 없는 개발 도구도 실제 설치하지만 수집 대상에 넣지 않는다.
  pkg('tool', { documents: {} })
  pkg('nested-tool', { documents: {} })
  const renderer = pkg('renderer', { documents: { LICENSE: 'Renderer fixture\r\n' } })

  assert.deepEqual(
    collectPackages([join(renderer, 'index.js'), join(renderer, 'index.js')], root),
    [
      {
        name: 'nested',
        version: '1.0.0',
        license: 'MIT',
        documents: [{ name: 'LICENSE', text: 'Nested fixture\n' }]
      },
      {
        name: 'optional',
        version: '1.0.0',
        license: 'MIT',
        documents: [{ name: 'LICENSE', text: 'Optional fixture\n' }]
      },
      {
        name: 'renderer',
        version: '1.0.0',
        license: 'MIT',
        documents: [{ name: 'LICENSE', text: 'Renderer fixture\r\n' }]
      },
      {
        name: 'runtime',
        version: '1.0.0',
        license: 'MIT',
        documents: [{ name: 'LICENSE', text: 'Runtime fixture\r\n' }]
      }
    ]
  )
})

test('별도 node_modules에 설치된 같은 이름의 서로 다른 버전을 각각 수집한다', (t) => {
  const { root, pkg, writeManifest } = createPackageFixture(t)
  writeManifest('', { dependencies: { parent: '1', shared: '1' } })
  const parent = pkg('parent', { manifest: { dependencies: { shared: '2' } } })
  pkg('shared', { documents: { LICENSE: 'Shared version 1 fixture\n' } })
  pkg('shared', {
    from: parent,
    manifest: { version: '2.0.0' },
    documents: { LICENSE: 'Shared version 2 fixture\n' }
  })

  assert.deepEqual(collectPackages([], root), [
    {
      name: 'parent',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: fixtureLicense }]
    },
    {
      name: 'shared',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'Shared version 1 fixture\n' }]
    },
    {
      name: 'shared',
      version: '2.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'Shared version 2 fixture\n' }]
    }
  ])
})

test('실제 입력으로 소비하는 개발 설치 peer는 포함하고 다른 개발 도구, peer 선언은 제외한다', (t) => {
  const { root, pkg, writeManifest } = createPackageFixture(t)
  writeManifest('', {
    dependencies: { ui: '1' },
    devDependencies: { peer: '1', tool: '1', 'unused-peer': '1' }
  })
  pkg('ui', { manifest: { peerDependencies: { peer: '1', 'unused-peer': '1' } } })
  const peer = pkg('peer', { documents: { LICENSE: 'Consumed peer fixture\r\n' } })
  pkg('tool', { documents: {} })
  pkg('unused-peer', { documents: {} })

  assert.deepEqual(collectPackages([join(peer, 'package.json')], root), [
    {
      name: 'peer',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: 'Consumed peer fixture\r\n' }]
    },
    {
      name: 'ui',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: fixtureLicense }]
    }
  ])
})

test('번들 입력은 실제 graph를 따르고 runtimeRoot를 전달할 때만 manifest 전이를 확장한다', (t) => {
  const { pkg } = createPackageFixture(t)
  const renderer = pkg('renderer', { manifest: { dependencies: { unbundled: '1' } } })
  pkg('unbundled', { documents: {} })

  assert.deepEqual(collectPackages([join(renderer, 'index.js')]), [
    {
      name: 'renderer',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: fixtureLicense }]
    }
  ])
  assert.throws(() => collectPackages([], renderer), {
    name: 'Error',
    message: 'Missing license text for unbundled@1.0.0'
  })
})

test('Windows 경로, query, 심볼릭 링크의 같은 입력을 중복 제거하고 가상 입력을 제외한다', (t) => {
  const { root, pkg, writeFile } = createPackageFixture(t)
  const peer = pkg('@example/peer')
  const moduleId = join(peer, 'index.js')
  const windowsId = moduleId.replaceAll('/', '\\')
  symlinkSync(peer, join(root, 'node_modules', 'peer-link'), 'dir')
  const ignored = pkg('virtual-only', { documents: {} })
  const source = writeFile('src/index.js', '')
  const expected = [
    {
      name: '@example/peer',
      version: '1.0.0',
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: fixtureLicense }]
    }
  ]

  assert.deepEqual(collectPackages([windowsId]), expected)
  assert.deepEqual(
    collectPackages([
      windowsId,
      `${moduleId}?commonjs-entry`,
      join(root, 'node_modules', 'peer-link', 'index.js'),
      `\0${join(ignored, 'index.js')}`,
      source,
      'virtual:dfragon-licenses'
    ]),
    expected
  )
})

test('이름 없는 중첩 ESM manifest는 소유 패키지를 가리지 않고 nested 고지 원문을 보존한다', (t) => {
  const { root, pkg, writeFile, writeManifest } = createPackageFixture(t)
  const directory = pkg('example', {
    documents: {
      LICENSE: 'Root fixture\r\n  원문 공백 유지  \n',
      'licenses/nested/third-party.txt': 'Nested fixture\r\n\t조건\r\n',
      'licenses/AUTHORS': 'Nested author fixture\n',
      'licenses/EMPTY': '',
      'LICENSE.empty.txt': ' \r\n\t',
      NOTICE: 'Notice fixture\n',
      COPYING: 'Copying fixture\n',
      'COPYRIGHT.txt': 'Copyright fixture\n',
      'ThirdPartyNotices.txt': 'Third party fixture\n',
      'src/LICENSE': 'Source directory must not be crawled\n',
      'licensee.txt': 'Non-notice root fixture\n'
    }
  })
  writeManifest(relative(root, join(directory, 'esm')), { type: 'module' })
  const nestedModule = writeFile(relative(root, join(directory, 'esm/index.js')), '')

  assert.equal(findPackageRoot(`${nestedModule}?module`), realpathSync(directory))
  assert.deepEqual(packageNotice(directory), {
    name: 'example',
    version: '1.0.0',
    license: 'MIT',
    documents: [
      { name: 'COPYING', text: 'Copying fixture\n' },
      { name: 'COPYRIGHT.txt', text: 'Copyright fixture\n' },
      { name: 'LICENSE', text: 'Root fixture\r\n  원문 공백 유지  \n' },
      { name: 'licenses/AUTHORS', text: 'Nested author fixture\n' },
      { name: 'licenses/nested/third-party.txt', text: 'Nested fixture\r\n\t조건\r\n' },
      { name: 'NOTICE', text: 'Notice fixture\n' },
      { name: 'ThirdPartyNotices.txt', text: 'Third party fixture\n' }
    ]
  })
})

test('wildcard exports가 존재하지 않는 package.json을 가리키면 entry의 소유 패키지를 찾는다', (t) => {
  const { root, pkg } = createPackageFixture(t)
  const directory = pkg('wildcard', {
    manifest: { exports: { '.': './index.js', './*': './lib/*' } }
  })

  assert.equal(resolvePackageRoot('wildcard', root), realpathSync(directory))
})

test('package.json export가 막혀 있어도 실제 entry의 소유 패키지를 찾는다', (t) => {
  const { root, pkg } = createPackageFixture(t)
  const directory = pkg('@example/entry-only', { manifest: { exports: './index.js' } })

  assert.equal(resolvePackageRoot('@example/entry-only', root), realpathSync(directory))
})

test('설치되지 않은 필수 전이 의존성은 optional 누락처럼 건너뛰지 않는다', (t) => {
  const { root, pkg, writeManifest } = createPackageFixture(t)
  writeManifest('', { dependencies: { runtime: '1' } })
  pkg('runtime', { manifest: { dependencies: { 'required-missing': '1' } } })

  assert.throws(() => collectPackages([], root), {
    code: 'MODULE_NOT_FOUND',
    message: /Cannot find module 'required-missing'/
  })
})

test('설치된 optional 의존성의 원문 누락은 빌드를 실패시킨다', (t) => {
  const { root, pkg, writeManifest } = createPackageFixture(t)
  writeManifest('', { optionalDependencies: { optional: '1' } })
  pkg('optional', { documents: {} })

  assert.throws(() => collectPackages([], root), {
    name: 'Error',
    message: 'Missing license text for optional@1.0.0'
  })
})

for (const { title, documents } of [
  { title: '원문 파일 누락', documents: {} },
  { title: '빈 LICENSE 파일', documents: { LICENSE: '' } },
  { title: '공백만 있는 중첩 LICENSE 파일', documents: { 'licenses/nested/LICENSE': ' \r\n\t' } }
]) {
  test(`${title}은 확인되지 않은 패키지의 원문으로 인정하지 않는다`, (t) => {
    const { pkg } = createPackageFixture(t)
    const directory = pkg('unknown', { documents })

    assert.throws(() => packageNotice(directory), {
      name: 'Error',
      message: 'Missing license text for unknown@1.0.0'
    })
  })
}

test('고정 버전의 upstream 원문을 완전한 내용으로 보완하고 기존 고지도 유지한다', (t) => {
  const { pkg } = createPackageFixture(t)
  const original = readFileSync(
    new URL('../notices/upstream/stylex-LICENSE.txt', import.meta.url),
    'utf8'
  )
  const directory = pkg('@stylexjs/stylex', {
    manifest: { version: '0.19.0' },
    documents: { NOTICE: 'Installed attribution fixture\r\n' }
  })

  assert.deepEqual(packageNotice(directory), {
    name: '@stylexjs/stylex',
    version: '0.19.0',
    license: 'MIT',
    documents: [
      { name: 'NOTICE', text: 'Installed attribution fixture\r\n' },
      { name: 'upstream/stylex-LICENSE.txt', text: original }
    ]
  })
})

test('원문이 없는 패키지는 등록된 버전만 보완하고 다른 버전에는 적용하지 않는다', (t) => {
  const { pkg } = createPackageFixture(t)
  const original = readFileSync(
    new URL('../notices/upstream/stylex-LICENSE.txt', import.meta.url),
    'utf8'
  )
  const supported = pkg('@stylexjs/stylex', {
    manifest: { version: '0.19.0' },
    documents: {}
  })

  assert.deepEqual(packageNotice(supported), {
    name: '@stylexjs/stylex',
    version: '0.19.0',
    license: 'MIT',
    documents: [{ name: 'upstream/stylex-LICENSE.txt', text: original }]
  })
  const unsupported = pkg('@stylexjs/stylex', {
    from: pkg('different-owner'),
    manifest: { version: '99.0.0' },
    documents: {}
  })
  assert.throws(() => packageNotice(unsupported), {
    name: 'Error',
    message: 'Missing license text for @stylexjs/stylex@99.0.0'
  })
})

test('Koffi 플랫폼 패키지는 같은 버전의 부모 보완 원문들을 수집한다', (t) => {
  const { pkg } = createPackageFixture(t)
  const directory = pkg('@koromix/koffi-linux-x64', {
    manifest: { version: '3.2.1', license: 'ISC' },
    documents: {}
  })

  assert.deepEqual(packageNotice(directory), {
    name: '@koromix/koffi-linux-x64',
    version: '3.2.1',
    license: 'ISC',
    documents: [
      {
        name: 'upstream/koffi-LICENSE.txt',
        text: readFileSync(
          new URL('../notices/upstream/koffi-LICENSE.txt', import.meta.url),
          'utf8'
        )
      },
      {
        name: 'upstream/node-api-headers-LICENSE.txt',
        text: readFileSync(
          new URL('../notices/upstream/node-api-headers-LICENSE.txt', import.meta.url),
          'utf8'
        )
      },
      {
        name: 'upstream/node-addon-api-LICENSE.txt',
        text: readFileSync(
          new URL('../notices/upstream/node-addon-api-LICENSE.txt', import.meta.url),
          'utf8'
        )
      }
    ]
  })
  const unsupported = pkg('@koromix/koffi-linux-x64', {
    from: pkg('different-owner'),
    manifest: { version: '99.0.0', license: 'ISC' },
    documents: {}
  })
  assert.throws(() => packageNotice(unsupported), {
    name: 'Error',
    message: 'Missing license text for @koromix/koffi-linux-x64@99.0.0'
  })
})

test('보완 원문의 checksum 불일치는 격리된 사본에서 빌드를 실패시킨다', async (t) => {
  const { pkg, writeFile, writeManifest } = createPackageFixture(t)
  const original = readFileSync(
    new URL('../notices/upstream/stylex-LICENSE.txt', import.meta.url),
    'utf8'
  )
  writeManifest('isolated-tool', { type: 'module' })
  const source = writeFile(
    'isolated-tool/src/collect.ts',
    readFileSync(new URL('../src/collect.ts', import.meta.url), 'utf8')
  )
  writeFile(
    'isolated-tool/overrides.json',
    readFileSync(new URL('../overrides.json', import.meta.url), 'utf8')
  )
  writeFile('isolated-tool/notices/upstream/stylex-LICENSE.txt', original)
  const isolatedCollector: typeof import('../src/collect.ts') = await import(
    pathToFileURL(source).href
  )
  const directory = pkg('@stylexjs/stylex', {
    manifest: { version: '0.19.0' },
    documents: {}
  })

  assert.deepEqual(isolatedCollector.packageNotice(directory).documents, [
    { name: 'upstream/stylex-LICENSE.txt', text: original }
  ])
  writeFile('isolated-tool/notices/upstream/stylex-LICENSE.txt', `${original}\nAltered fixture\n`)
  assert.throws(() => isolatedCollector.packageNotice(directory), {
    name: 'Error',
    message: 'License checksum mismatch for @stylexjs/stylex@0.19.0'
  })
})

for (const { title, documents } of [
  { title: '원문 파일이 없는 경우', documents: {} },
  { title: 'LICENSE가 공백뿐인 경우', documents: { LICENSE: ' \t\r\n' } }
]) {
  test(`guid-typescript@1.0.9는 ${title} 원문 공백을 명시적으로 보존한다`, (t) => {
    const { pkg } = createPackageFixture(t)
    const directory = pkg('guid-typescript', {
      manifest: { version: '1.0.9', license: 'ISC' },
      documents
    })

    assert.deepEqual(packageNotice(directory), {
      name: 'guid-typescript',
      version: '1.0.9',
      license: 'ISC · 원문 확인 필요',
      documents: [
        {
          name: 'LICENSE-STATUS.txt',
          text: '이 패키지는 npm에서 ISC를 선언하지만 배포 패키지와 현재 공식 저장소에 라이선스 원문이 없습니다. 저작권 문구를 추정하지 않았으며 원문 확보가 필요합니다.\nhttps://www.npmjs.com/package/guid-typescript/v/1.0.9\nhttps://github.com/snico-dev/guid-typescript'
        }
      ]
    })
    const otherVersion = pkg('guid-typescript', {
      from: pkg('different-owner'),
      manifest: { version: '1.0.10', license: 'ISC' },
      documents
    })
    assert.throws(() => packageNotice(otherVersion), {
      name: 'Error',
      message: 'Missing license text for guid-typescript@1.0.10'
    })
  })
}
