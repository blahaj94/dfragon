import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { rendererTransforms } from '../build/renderer-transforms'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { uiNotices, desktopLicenseCatalog } from '@dfragon/licenses/vite'

const LIB_IMPORT_PATTERN = /^@dfragon\/lib$/
const OCR_CONTRACT_IMPORT_PATTERN = /^@dfragon\/lib\/ocr-contract$/
const PAGINATION_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/pagination$/
const UI_IMPORT_PATTERN = /^@dfragon\/ui$/

export default defineConfig({
  main: {
    resolve: {
      alias: [
        { find: LIB_IMPORT_PATTERN, replacement: resolve('../../packages/lib/src/index.ts') },
        {
          find: OCR_CONTRACT_IMPORT_PATTERN,
          replacement: resolve('../../packages/lib/src/ocr-contract.ts')
        }
      ]
    },
    build: {
      externalizeDeps: { exclude: ['ky', '@dfragon/lib'] },
      lib: { entry: resolve('scripts/auth-capture-fixture/main.ts'), formats: ['cjs'] },
      outDir: 'out/auth-capture-fixture/main',
      rollupOptions: { output: { entryFileNames: 'main.cjs' } }
    }
  },
  preload: {
    resolve: {
      alias: [{ find: LIB_IMPORT_PATTERN, replacement: resolve('../../packages/lib/src/index.ts') }]
    },
    build: {
      externalizeDeps: false,
      lib: { entry: resolve('src/preload/index.ts'), formats: ['cjs'] },
      outDir: 'out/auth-capture-fixture/preload',
      rollupOptions: { output: { entryFileNames: 'preload.cjs' } }
    }
  },
  renderer: {
    worker: { format: 'es' },
    root: resolve('src/frontend/src/fixture/auth-capture'),
    publicDir: resolve('src/frontend/public'),
    plugins: [
      ...rendererTransforms(),
      seedDesignPlugin(),
      uiNotices({ uiRoot: resolve('../../packages/ui') }),
      desktopLicenseCatalog({
        runtimeRoot: resolve('.'),
        uiRoot: resolve('../../packages/ui'),
        ocrRoot: resolve('assets/ocr')
      })
    ],
    resolve: {
      alias: [
        {
          find: './party-capture-session',
          replacement: resolve('src/frontend/src/fixture/auth-capture/legacy-capture-session.ts')
        },
        { find: LIB_IMPORT_PATTERN, replacement: resolve('../../packages/lib/src/index.ts') },
        {
          find: PAGINATION_IMPORT_PATTERN,
          replacement: resolve('../../packages/lib/src/utils/pagination.ts')
        },
        { find: UI_IMPORT_PATTERN, replacement: resolve('../../packages/ui/src/index.tsx') }
      ]
    },
    build: {
      outDir: resolve('out/auth-capture-fixture/renderer'),
      rollupOptions: {
        input: {
          index: resolve('src/frontend/src/fixture/auth-capture/index.html'),
          legacySearch: resolve('src/frontend/src/fixture/auth-capture/legacy-search.html'),
          source: resolve('src/frontend/src/fixture/auth-capture/source.html')
        }
      }
    }
  }
})
