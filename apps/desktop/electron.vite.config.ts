import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { rendererTransforms } from './build/renderer-transforms'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { uiNotices } from '../../packages/ui/build/notices.ts'
import { readDistributionApiOrigin } from './build/distribution-config'

export default defineConfig(({ mode }) => ({
  main: {
    define: {
      __LDB_DEVELOPMENT_AUTH__: JSON.stringify(mode === 'ldb-development'),
      __LDB_DISTRIBUTION_API_ORIGIN__: JSON.stringify(
        mode === 'ldb-distribution' ? readDistributionApiOrigin() : null
      )
    },
    build: {
      // Ky is ESM-only; bundle its default export into the CommonJS main process.
      externalizeDeps: { exclude: ['ky'] },
      lib: {
        entry: resolve('src/backend/main.ts')
      },
      outDir: 'out/backend'
    }
  },
  preload: { build: { externalizeDeps: false } },
  renderer: {
    worker: { format: 'es' },
    root: resolve('src/frontend'),
    build: {
      rollupOptions: {
        input: resolve('src/frontend/index.html'),
        output: {
          assetFileNames: 'assets/[name][extname]'
        }
      },
      outDir: 'out/frontend'
    },
    resolve: {
      alias: [
        { find: '@frontend', replacement: resolve('src/frontend/src') },
        { find: /^@ldb\/ui$/, replacement: resolve('../../packages/ui/src/index.tsx') }
      ]
    },
    plugins: [...rendererTransforms(), seedDesignPlugin(), uiNotices()]
  }
}))
