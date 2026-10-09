import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { desktopNotices } from '../src/vite.ts'
import { createPackageFixture } from './fixtures.ts'

const noticeFiles = {
  ui: ['ICONS-LICENSE', 'ICONS-NOTICE', 'SEED-LICENSE', 'SEED-NOTICE'],
  lib: ['iconv-lite-LICENSE'],
  desktop: ['FONT-LICENSE', 'LUCIDE-LICENSE', 'NOTICE.md']
}
const copyCommand = fileURLToPath(new URL('../src/copy-notices.mjs', import.meta.url))

test('Desktop plugin은 중앙 글꼴, 아이콘, 자산 고지를 기존 배포 경로에 원문 그대로 낸다', () => {
  const assets = new Map<string, string>()
  desktopNotices().generateBundle.call({
    emitFile(asset) {
      assets.set(asset.fileName, asset.source)
    }
  })

  assert.deepEqual(
    [...assets.keys()],
    ['notices/desktop/FONT-LICENSE', 'notices/desktop/LUCIDE-LICENSE', 'notices/desktop/NOTICE.md']
  )
  for (const name of noticeFiles.desktop) {
    assert.equal(
      assets.get(`notices/desktop/${name}`),
      readFileSync(new URL(`../notices/desktop/${name}`, import.meta.url), 'utf8'),
      name
    )
  }
})

for (const group of ['ui', 'lib', 'desktop'] as const) {
  test(`${group} CLI는 지정한 출력 디렉터리에 원문을 복사하고 기존 앱 파일을 보존한다`, (t) => {
    const fixture = createPackageFixture(t)
    const destination = join(fixture.root, 'dist', 'notices')
    fixture.writeFile('dist/notices/app-notice.txt', 'Existing app attribution\r\n')

    const result = spawnSync(process.execPath, [copyCommand, group, destination], {
      cwd: fixture.root,
      encoding: 'utf8'
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.signal, null)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, '')
    assert.deepEqual(
      readdirSync(destination).sort(),
      [...noticeFiles[group], 'app-notice.txt'].sort()
    )
    assert.equal(
      readFileSync(join(destination, 'app-notice.txt'), 'utf8'),
      'Existing app attribution\r\n'
    )
    for (const name of noticeFiles[group]) {
      assert.deepEqual(
        readFileSync(join(destination, name)),
        readFileSync(new URL(`../notices/${group}/${name}`, import.meta.url)),
        name
      )
    }
  })
}

test('CLI는 존재하지 않는 중첩 출력 디렉터리를 만든다', (t) => {
  const fixture = createPackageFixture(t)
  const destination = join(fixture.root, 'new', 'dist', 'notices')

  const result = spawnSync(process.execPath, [copyCommand, 'lib', destination], {
    cwd: fixture.root,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readdirSync(destination), ['iconv-lite-LICENSE'])
  assert.deepEqual(
    readFileSync(join(destination, 'iconv-lite-LICENSE')),
    readFileSync(new URL('../notices/lib/iconv-lite-LICENSE', import.meta.url))
  )
})

for (const scenario of [
  { name: '지원하지 않는 고지 그룹', arguments: ['upstream'], includeDestination: true },
  { name: '출력 경로 누락', arguments: ['ui'], includeDestination: false },
  { name: '그룹과 출력 경로 누락', arguments: [], includeDestination: false }
]) {
  test(`CLI는 ${scenario.name}을 실패로 처리하고 출력 디렉터리를 만들지 않는다`, (t) => {
    const fixture = createPackageFixture(t)
    const destination = join(fixture.root, 'output')
    const arguments_ = [...scenario.arguments]
    if (scenario.includeDestination) {
      arguments_.push(destination)
    }

    const result = spawnSync(process.execPath, [copyCommand, ...arguments_], {
      cwd: fixture.root,
      encoding: 'utf8'
    })

    assert.equal(result.status, 1)
    assert.equal(result.signal, null)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /Use dfragon-copy-notices ui\|lib\|desktop <output directory>/)
    assert.equal(existsSync(destination), false)
    assert.deepEqual(readdirSync(fixture.root), [])
  })
}
