import { stylexOptions } from '@dfragon/ui/stylex-config'
import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { workspaceAliases } from './workspace-aliases.ts'

export default defineConfig({
  plugins: [stylex.rollup(stylexOptions), react()],
  resolve: { alias: workspaceAliases, dedupe: ['react', 'react-dom'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts']
  }
})
