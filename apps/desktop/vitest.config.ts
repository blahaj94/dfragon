import { fileURLToPath } from 'node:url'
import { rendererTransforms } from './build/renderer-transforms'
import { defineConfig } from 'vitest/config'
import { desktopLicenseCatalog } from '@dfragon/licenses/vite'

export default defineConfig({
  plugins: [
    ...rendererTransforms({ test: true }),
    desktopLicenseCatalog({
      runtimeRoot: fileURLToPath(new URL('.', import.meta.url)),
      uiRoot: fileURLToPath(new URL('../../packages/ui', import.meta.url)),
      ocrRoot: fileURLToPath(new URL('assets/ocr', import.meta.url))
    })
  ],
  resolve: {
    alias: [
      {
        find: /^@dfragon\/ui$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.tsx', import.meta.url))
      }
    ]
  },
  test: {
    setupFiles: ['../../packages/ui/test/setup.ts'],
    server: { deps: { inline: [/@seed-design\//] } }
  }
})
