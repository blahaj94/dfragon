import stylex from '@stylexjs/unplugin'
import { stylexOptions } from '../stylex.config.ts'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { uiNotices } from '@dfragon/licenses/vite'

export default defineConfig({
  base: './',
  root: fileURLToPath(new URL('./', import.meta.url)),
  plugins: [
    stylex.vite(stylexOptions),
    react(),
    seedDesignPlugin(),
    uiNotices({ uiRoot: fileURLToPath(new URL('../', import.meta.url)) })
  ],
  resolve: {
    alias: [
      {
        find: /^@dfragon\/ui$/,
        replacement: fileURLToPath(new URL('../src/index.tsx', import.meta.url))
      }
    ]
  },
  build: { outDir: '../dist-examples', emptyOutDir: true }
})
