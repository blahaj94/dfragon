import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { defineConfig } from 'vite'

// source alias 없이 실제 package ESM entry와 소비자 소유 CSS를 번들링한다.
export default defineConfig({
  plugins: [react(), seedDesignPlugin()],
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
