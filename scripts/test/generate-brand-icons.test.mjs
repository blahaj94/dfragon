import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

const outputs = [
  ['apps/desktop/build/icon.ico', 'ico/icon.ico'],
  ['apps/desktop/build/icon.icns', 'icns/icon.icns'],
  ['apps/desktop/build/icon.png', 'set/512x512.png'],
  ['apps/desktop/resources/icon.png', 'set/512x512.png'],
  ['apps/desktop/resources/brand.png', 'set/128x128.png'],
  ['apps/accounts/browser/icon.png', 'set/128x128.png'],
  ['apps/web/public/favicon.png', 'set/64x64.png']
]

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dfragon-icon-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const files = {
    'assets/brand/dfragon.png': '합성 브랜드 원본',
    'node_modules/electron-builder/package.json': '{"main":"index.cjs"}',
    'node_modules/electron-builder/index.cjs': '',
    'node_modules/app-builder-lib/package.json': '{"type":"commonjs"}'
  }
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  for (const [path] of outputs) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), '기존 아이콘')
  }
  mkdirSync(join(root, 'node_modules/app-builder-lib/out/toolsets'), { recursive: true })
  copyFileSync(
    new URL('./fixtures/icons-tool.cjs', import.meta.url),
    join(root, 'node_modules/app-builder-lib/out/toolsets/icons.js')
  )
  mkdirSync(join(root, 'scripts'))
  copyFileSync(
    new URL('../generate-brand-icons.mjs', import.meta.url),
    join(root, 'scripts/generate-brand-icons.mjs')
  )
  const temporary = join(root, 'temporary')
  const cwd = join(root, 'unrelated directory')
  mkdirSync(temporary)
  mkdirSync(cwd)
  const run = (extra = {}) =>
    spawnSync(process.execPath, [join(root, 'scripts/generate-brand-icons.mjs')], {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        TMPDIR: temporary,
        TMP: temporary,
        TEMP: temporary,
        ICON_FAIL_FORMAT: '',
        ...extra
      }
    })

  return { root, temporary, cwd, run }
}

test('변환한 형식과 크기를 각 앱 경로에 복사하고 임시 디렉터리를 정리한다', (t) => {
  const { root, temporary, cwd, run } = fixture(t)
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  for (const [path, expected] of outputs) {
    assert.equal(readFileSync(join(root, path), 'utf8'), expected, path)
  }
  assert.deepEqual(readdirSync(temporary), [])
  assert.deepEqual(readdirSync(cwd), [])
})

test('일부 형식 변환 뒤 실패하면 기존 아이콘을 보존하고 임시 결과를 정리한다', (t) => {
  const { root, temporary, run } = fixture(t)
  const result = run({ ICON_FAIL_FORMAT: 'icns' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /합성 변환 실패/)
  for (const [path] of outputs) {
    assert.equal(readFileSync(join(root, path), 'utf8'), '기존 아이콘', path)
  }
  assert.deepEqual(readdirSync(temporary), [])
})

test('대상 파일 복사 실패도 실패 코드로 전파하고 임시 변환 결과를 정리한다', (t) => {
  const { root, temporary, run } = fixture(t)
  const blockedTarget = join(root, 'apps/desktop/build/icon.ico')
  rmSync(blockedTarget)
  mkdirSync(blockedTarget)
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /EISDIR/)
  assert.deepEqual(readdirSync(blockedTarget), [])
  assert.deepEqual(readdirSync(temporary), [])
})
