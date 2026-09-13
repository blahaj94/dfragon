import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/windows-crash-fixture/native.fixture.ts'],
    fileParallelism: false,
    disableConsoleIntercept: true,
    testTimeout: 900_000
  }
})
