import { fileURLToPath } from 'node:url'

const SHARED_UI_IMPORT_PATTERN = /^@dfragon\/ui$/
const LIB_IMPORT_PATTERN = /^@dfragon\/lib$/
const DESKTOP_SITE_IMPORT_PATTERN = /^@dfragon\/desktop-site$/
const DESKTOP_SITE_TIME_IMPORT_PATTERN = /^@dfragon\/desktop-site\/time-of-day$/

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

// 창 목업과 첫 화면 배경은 Desktop renderer의 실제 컴포넌트와 그림을 쓰므로 Desktop이 사이트용으로 공개한
// entry만 source로 읽는다. 시간대 entry는 첫 화면에 바로 필요하고, 목업 entry는 나중에 받는다.
export const workspaceAliases = [
  { find: SHARED_UI_IMPORT_PATTERN, replacement: source('../../packages/ui/src/index.tsx') },
  { find: LIB_IMPORT_PATTERN, replacement: source('../../packages/lib/src/index.ts') },
  {
    find: DESKTOP_SITE_IMPORT_PATTERN,
    replacement: source('../desktop/src/frontend/src/site/index.ts')
  },
  {
    find: DESKTOP_SITE_TIME_IMPORT_PATTERN,
    replacement: source('../desktop/src/frontend/src/site/time-of-day.ts')
  }
]
