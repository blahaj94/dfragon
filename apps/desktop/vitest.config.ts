import { fileURLToPath } from 'node:url'
import { rendererTransforms } from './build/renderer-transforms'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: rendererTransforms({ test: true }),
  resolve: {
    alias: [
      {
        find: /^@ldb\/ui$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.tsx', import.meta.url))
      }
    ]
  },
  test: {
    setupFiles: ['../../packages/ui/test/setup.ts'],
    server: { deps: { inline: [/@seed-design\//] } }
  }
})
