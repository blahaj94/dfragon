import stylex from '@stylexjs/unplugin'
import { stylexOptions } from '../../stylex.config.ts'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [stylex.vite(stylexOptions), react()],
  build: {
    outDir: 'node_modules/.tmp/build-consumer',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./main.tsx', import.meta.url)),
      formats: ['es'],
      fileName: 'consumer'
    }
  }
})
