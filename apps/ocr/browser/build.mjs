import { build } from 'esbuild'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import stylex from '@stylexjs/unplugin/esbuild'
import { collectPackages } from '@dfragon/licenses/collect'
import { resolve } from 'node:path'
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
await mkdir(new URL('../dist/browser/', import.meta.url), { recursive: true })
const result = await build({
  metafile: true,
  plugins: [stylex(stylexOptions)],
  entryPoints: ['browser/main.tsx'],
  bundle: true,
  jsx: 'automatic',
  minify: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/browser/app.js',
  loader: { '.woff2': 'file' },
  assetNames: 'assets/[name]-[hash]',
  alias: {
    '@dfragon/ui/typo': fileURLToPath(new URL('../../../packages/ui/src/typo.tsx', import.meta.url))
  },
  legalComments: 'linked',
  define: { 'process.env.NODE_ENV': '"production"' }
})
await copyFile(
  new URL('index.html', import.meta.url),
  new URL('../dist/browser/index.html', import.meta.url)
)

const notices = collectPackages(
  Object.keys(result.metafile.inputs).map((path) => resolve(path)),
  resolve('.')
)
await writeFile(
  new URL('../dist/browser/THIRD-PARTY.txt', import.meta.url),
  notices
    .map(
      (entry) =>
        `${entry.name}@${entry.version}\n${entry.documents.map((document) => `${document.name}\n${document.text}`).join('\n\n')}`
    )
    .join('\n\n--------------------\n\n') +
    '\n\nNanumSquare Neo\n' +
    (await readFile(
      new URL('../../../packages/licenses/notices/desktop/FONT-LICENSE', import.meta.url),
      'utf8'
    ))
)
