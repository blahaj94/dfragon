import stylex from '@stylexjs/unplugin'
import { stylexOptions } from './stylex.config.ts'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const SEED_DESIGN_IMPORT_PATTERN = /@seed-design\//

export default defineConfig({
  plugins: [stylex.rollup(stylexOptions), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    server: { deps: { inline: [SEED_DESIGN_IMPORT_PATTERN] } }
  }
})
