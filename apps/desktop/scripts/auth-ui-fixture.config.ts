import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { rendererTransforms } from '../build/renderer-transforms'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { uiNotices } from '../../../packages/ui/build/notices'

export default defineConfig({
  base: './',
  root: fileURLToPath(new URL('../src/frontend/src/testing/fixtures/auth/', import.meta.url)),
  plugins: [...rendererTransforms(), seedDesignPlugin(), uiNotices()],
  resolve: {
    alias: [
      {
        find: /^@ldb\/ui$/,
        replacement: fileURLToPath(new URL('../../../packages/ui/src/index.tsx', import.meta.url))
      }
    ]
  },
  build: {
    outDir: fileURLToPath(new URL('../out/auth-ui-fixture/', import.meta.url)),
    emptyOutDir: true
  }
})
