import stylex from '@stylexjs/unplugin'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const SEED_DESIGN_IMPORT_PATTERN = /@seed-design\//

export default defineConfig({
  plugins: [stylex.rollup(stylexOptions)],
  resolve: {
    alias: {
      '@dfragon/ui/typo': fileURLToPath(new URL('../../packages/ui/src/typo.tsx', import.meta.url)),
      '@dfragon/lib/ocr-contract': fileURLToPath(
        new URL('../../packages/lib/src/ocr-contract.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'jsdom',
    include: ['browser/**/*.test.{ts,tsx}'],
    server: { deps: { inline: [SEED_DESIGN_IMPORT_PATTERN] } }
  }
})
