import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Desktop처럼 @dfragon/lib를 build 산출물 없이 source로 해석한다.
const SHARED_LIBRARY_IMPORT_PATTERN = /^@dfragon\/lib$/

export default defineConfig({
  resolve: {
    alias: [
      {
        find: SHARED_LIBRARY_IMPORT_PATTERN,
        replacement: fileURLToPath(new URL('../lib/src/index.ts', import.meta.url))
      }
    ]
  }
})
