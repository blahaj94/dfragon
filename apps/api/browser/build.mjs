import { copyFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const qrPackage = require.resolve('qrcode/package.json')
const qrRequire = createRequire(qrPackage)
const qrLicense = await readFile(join(dirname(qrPackage), 'license'), 'utf8')
const pathLicense = await readFile(
  join(dirname(qrRequire.resolve('dijkstrajs/package.json')), 'LICENSE.md'),
  'utf8'
)

const reactLicense = await readFile(
  join(dirname(require.resolve('react/package.json')), 'LICENSE'),
  'utf8'
)

await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['browser/passkeys.tsx'],
  bundle: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  format: 'iife',
  target: 'es2022',
  outfile: 'dist/browser/passkeys.js',
  // Keep upstream notices in the delivered bundle without duplicating them in application code.
  banner: {
    js: `/*! qrcode\n${qrLicense}\ndijkstrajs\n${pathLicense}\nReact, React DOM and Scheduler\n${reactLicense}\n*/`
  }
})
await copyFile(
  new URL('./passkeys.html', import.meta.url),
  new URL('../dist/browser/passkeys.html', import.meta.url)
)
