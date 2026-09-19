import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { rendererTransforms } from '../build/renderer-transforms'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { uiNotices } from '@ldb/licenses/vite'

export default defineConfig({
  main: {
    build: {
      externalizeDeps: { exclude: ['ky'] },
      lib: { entry: resolve('scripts/auth-capture-fixture/main.ts'), formats: ['cjs'] },
      outDir: 'out/auth-capture-fixture/main',
      rollupOptions: { output: { entryFileNames: 'main.cjs' } }
    }
  },
  preload: {
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
      uiNotices({ uiRoot: resolve('../../packages/ui') })
    ],
    resolve: {
      alias: [{ find: /^@ldb\/ui$/, replacement: resolve('../../packages/ui/src/index.tsx') }]
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
