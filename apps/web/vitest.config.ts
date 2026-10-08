import stylex from '@stylexjs/unplugin'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const SHARED_UI_IMPORT_PATTERN = /^@dfragon\/ui$/
const SEED_DESIGN_IMPORT_PATTERN = /@seed-design\//

export default defineConfig({
  plugins: [stylex.rollup(stylexOptions), react()],
  resolve: {
    alias: [
      {
        find: SHARED_UI_IMPORT_PATTERN,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.tsx', import.meta.url))
      }
    ]
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    server: { deps: { inline: [SEED_DESIGN_IMPORT_PATTERN] } }
  }
})
