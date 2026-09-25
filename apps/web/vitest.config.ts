import stylex from '@stylexjs/unplugin'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [stylex.rollup(stylexOptions), react()],
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
