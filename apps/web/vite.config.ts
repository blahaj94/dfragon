import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { uiNotices } from '@dfragon/licenses/vite'

export default defineConfig({
  plugins: [
    react(),
    seedDesignPlugin(),
    uiNotices({ uiRoot: fileURLToPath(new URL('../../packages/ui/', import.meta.url)) })
  ],
  resolve: {
    alias: [
      {
        find: /^@dfragon\/ui$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.tsx', import.meta.url))
      }
    ]
  }
})
