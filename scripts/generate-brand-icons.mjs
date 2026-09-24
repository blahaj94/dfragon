import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const desktopRequire = createRequire(new URL('../apps/desktop/package.json', import.meta.url))
const builderRequire = createRequire(desktopRequire.resolve('electron-builder'))
const { runIconsTool } = builderRequire('app-builder-lib/out/toolsets/icons.js')
const output = await mkdtemp(join(tmpdir(), 'dfragon-brand-icons-'))

try {
  for (const format of ['ico', 'icns', 'set']) {
    await runIconsTool({
      inputFile: join(root, 'assets/brand/dfragon.png'),
      outputFormat: format,
      outDir: join(output, format)
    })
  }

  const assets = [
    ['ico/icon.ico', 'apps/desktop/build/icon.ico'],
    ['icns/icon.icns', 'apps/desktop/build/icon.icns'],
    ['set/512x512.png', 'apps/desktop/build/icon.png'],
    ['set/512x512.png', 'apps/desktop/resources/icon.png'],
    ['set/128x128.png', 'apps/desktop/resources/brand.png'],
    ['set/128x128.png', 'apps/api/browser/icon.png'],
    ['set/64x64.png', 'apps/web/public/favicon.png']
  ]
  for (const [source, target] of assets) {
    await copyFile(join(output, source), join(root, target))
  }
} finally {
  await rm(output, { recursive: true, force: true })
}
