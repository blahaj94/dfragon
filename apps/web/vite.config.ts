import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { desktopNotices, uiNotices } from '@dfragon/licenses/vite'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { unplugin as stylex } from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { workspaceAliases } from './workspace-aliases.ts'

const siteNotices = {
  name: 'site-notices',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'notices/site/NOTICE.md',
      source: readFileSync(fileURLToPath(new URL('./NOTICE.md', import.meta.url)), 'utf8')
    })
  }
} satisfies Plugin

export default defineConfig({
  plugins: [stylex.vite(stylexOptions), react(), uiNotices(), desktopNotices(), siteNotices],
  resolve: { alias: workspaceAliases, dedupe: ['react', 'react-dom'] }
})
