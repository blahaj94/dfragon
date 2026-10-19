import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// 표본이 있는 로컬 환경에서만 의미가 있어 기본 `vitest run`의 include에는 걸리지 않는 `*.evaluation.ts`만 실행한다.
const LIBRARY_IMPORT_PATTERN = /^@dfragon\/lib$/

export default defineConfig({
  resolve: {
    alias: [
      {
        find: LIBRARY_IMPORT_PATTERN,
        replacement: fileURLToPath(
          new URL('../../../../packages/lib/src/index.ts', import.meta.url)
        )
      }
    ]
  },
  test: {
    include: ['scripts/raid-row-evaluation/*.evaluation.ts'],
    fileParallelism: false,
    disableConsoleIntercept: true,
    // 표본 수에 비례하는 오프라인 측정이라 일반 테스트의 기본 제한을 쓰지 않는다.
    testTimeout: 30 * 60_000
  }
})
