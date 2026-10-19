import { fileURLToPath } from 'node:url'
import { rendererTransforms } from './build/renderer-transforms'
import { defineConfig, type Plugin } from 'vitest/config'
import { desktopLicenseCatalog } from '@dfragon/licenses/vite'

const OCR_CONTRACT_IMPORT_PATTERN = /^@dfragon\/lib\/ocr-contract$/
const PAGINATION_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/pagination$/
const SHAPE_CHECK_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/shape-check$/
const SHARED_LIBRARY_IMPORT_PATTERN = /^@dfragon\/lib$/
const SHARED_UI_IMPORT_PATTERN = /^@dfragon\/ui$/
const ASSET_IMPORT_SUFFIX = '?asset'

/** Electron Vite가 main 번들 옆에 내보내는 `?asset` 파일을 테스트에서는 원본 파일 경로로 읽는다. */
function sourceAssetPaths(): Plugin {
  return {
    name: 'dfragon-source-asset-paths',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!source.endsWith(ASSET_IMPORT_SUFFIX) || importer === undefined) {
        return null
      }
      const file = source.slice(0, -ASSET_IMPORT_SUFFIX.length)
      const resolved = await this.resolve(file, importer, { skipSelf: true })
      if (resolved === null) {
        return null
      }

      return `${resolved.id}${ASSET_IMPORT_SUFFIX}`
    },
    load(id) {
      if (!id.endsWith(ASSET_IMPORT_SUFFIX)) {
        return null
      }

      return `export default ${JSON.stringify(id.slice(0, -ASSET_IMPORT_SUFFIX.length))}`
    }
  }
}

export default defineConfig({
  plugins: [
    sourceAssetPaths(),
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
        find: SHAPE_CHECK_IMPORT_PATTERN,
        replacement: fileURLToPath(
          new URL('../../packages/lib/src/utils/shape-check.ts', import.meta.url)
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
    // 파일마다 child process를 새로 띄우는 forks보다 worker thread가 빠르고, 파일 격리는 유지한다.
    // isolate: false와 vmThreads는 이 suite의 테스트가 깨져 쓰지 않는다.
    pool: 'threads'
  }
})
