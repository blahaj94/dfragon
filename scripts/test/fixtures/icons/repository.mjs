import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export function createIconFixture(t, outputPaths) {
  const root = mkdtempSync(join(tmpdir(), 'dfragon-icon-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'assets/brand'), { recursive: true })
  writeFileSync(join(root, 'assets/brand/dfragon.png'), '합성 브랜드 원본')
  cpSync(new URL('./packages/', import.meta.url), join(root, 'node_modules'), { recursive: true })

  for (const path of outputPaths) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), '기존 아이콘')
  }

  mkdirSync(join(root, 'node_modules/app-builder-lib/out/toolsets'), { recursive: true })
  copyFileSync(
    new URL('../icons-tool.cjs', import.meta.url),
    join(root, 'node_modules/app-builder-lib/out/toolsets/icons.js')
  )
  mkdirSync(join(root, 'scripts'))
  copyFileSync(
    new URL('../../../generate-brand-icons.mjs', import.meta.url),
    join(root, 'scripts/generate-brand-icons.mjs')
  )
  const temporary = join(root, 'temporary')
  const cwd = join(root, 'unrelated directory')
  mkdirSync(temporary)
  writeFileSync(join(temporary, 'unrelated.txt'), '다른 작업의 임시 파일')
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
