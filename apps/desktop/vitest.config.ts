import { fileURLToPath } from 'node:url'
import { rendererTransforms } from './build/renderer-transforms'
import { defineConfig } from 'vitest/config'
import { desktopLicenseCatalog } from '@dfragon/licenses/vite'

const OCR_CONTRACT_IMPORT_PATTERN = /^@dfragon\/lib\/ocr-contract$/
const PAGINATION_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/pagination$/
const SHARED_LIBRARY_IMPORT_PATTERN = /^@dfragon\/lib$/
const SHARED_UI_IMPORT_PATTERN = /^@dfragon\/ui$/
const SEED_DESIGN_IMPORT_PATTERN = /@seed-design\//

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
        find: OCR_CONTRACT_IMPORT_PATTERN,
        replacement: fileURLToPath(
          new URL('../../packages/lib/src/ocr-contract.ts', import.meta.url)
        )
      },
      {
        find: PAGINATION_IMPORT_PATTERN,
        replacement: fileURLToPath(
          new URL('../../packages/lib/src/utils/pagination.ts', import.meta.url)
        )
      },
      {
        find: SHARED_LIBRARY_IMPORT_PATTERN,
        replacement: fileURLToPath(new URL('../../packages/lib/src/index.ts', import.meta.url))
      },
      {
        find: SHARED_UI_IMPORT_PATTERN,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.tsx', import.meta.url))
      }
    ]
  },
  test: {
    setupFiles: ['../../packages/ui/test/setup.ts'],
    server: { deps: { inline: [SEED_DESIGN_IMPORT_PATTERN] } }
  }
})
