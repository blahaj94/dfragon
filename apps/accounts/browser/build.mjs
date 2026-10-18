import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import stylex from '@stylexjs/unplugin/esbuild'
import { stylexOptions } from '@dfragon/ui/stylex-config'

const require = createRequire(import.meta.url)
const reactLicense = await readFile(
  join(dirname(require.resolve('react/package.json')), 'LICENSE'),
  'utf8'
)

const stylexLicense = await readFile(
  new URL('../../../packages/licenses/notices/upstream/stylex-LICENSE.txt', import.meta.url),
  'utf8'
)

await build({
  metafile: true,
  plugins: [stylex(stylexOptions)],
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['browser/passkeys.tsx'],
  bundle: true,
  alias: {
    '@dfragon/ui/typo': fileURLToPath(new URL('../../../packages/ui/src/typo.tsx', import.meta.url))
  },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  format: 'iife',
  target: 'es2022',
  outfile: 'dist/browser/passkeys.js',
  // Keep upstream notices in the delivered bundle without duplicating them in application code.
  banner: {
    js: `/*! React, React DOM and Scheduler\n${reactLicense}\nStyleX\n${stylexLicense}\n*/`
  }
})
// 시스템 색 모드는 deferred bundle보다 먼저, 첫 페인트 전에 정해야 하므로 HTML에 nonce 인라인 script로 넣는다.
const themeBuild = await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['browser/theme.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  write: false
})
const themeScript = themeBuild.outputFiles[0].text.trim()
const themeMarker = '<!-- system-theme-script -->'
const pageTemplate = await readFile(new URL('./passkeys.html', import.meta.url), 'utf8')
if (!pageTemplate.includes(themeMarker)) {
  throw new Error('passkeys.html is missing the system theme script marker')
}
await writeFile(
  new URL('../dist/browser/passkeys.html', import.meta.url),
  pageTemplate.replace(themeMarker, `<script nonce="{{nonce}}">${themeScript}</script>`)
)
await copyFile(
  new URL('./icon.png', import.meta.url),
  new URL('../dist/browser/icon.png', import.meta.url)
)
