import { unplugin as stylex } from '@stylexjs/unplugin'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { uiNotices } from '@dfragon/licenses/vite'

const SHARED_UI_IMPORT_PATTERN = /^@dfragon\/ui$/

export default defineConfig({
  plugins: [
    stylex.vite(stylexOptions),
    react(),
    uiNotices({ uiRoot: fileURLToPath(new URL('../../packages/ui/', import.meta.url)) })
  ],
  resolve: {
    alias: [
      {
        find: SHARED_UI_IMPORT_PATTERN,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.tsx', import.meta.url))
      }
    ]
  }
})
