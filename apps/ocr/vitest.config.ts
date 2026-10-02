import stylex from '@stylexjs/unplugin'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

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
    server: { deps: { inline: [/@seed-design\//] } }
  }
})
