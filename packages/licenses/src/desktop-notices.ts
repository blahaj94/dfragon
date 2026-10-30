import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

type AssetContext = {
  emitFile(asset: { type: 'asset'; fileName: string; source: string }): unknown
}

const noticesRoot = fileURLToPath(new URL('../notices/', import.meta.url))

function emitNoticeGroups(context: AssetContext, groups: string[]): void {
  for (const group of groups) {
    const groupRoot = join(noticesRoot, group)
    for (const name of readdirSync(groupRoot).sort()) {
      context.emitFile({
        type: 'asset',
        fileName: `notices/${group}/${name}`,
        source: readFileSync(join(groupRoot, name), 'utf8')
      })
    }
  }
}

export function desktopNotices() {
  return {
    name: 'dfragon-desktop-notices',
    generateBundle(this: AssetContext) {
      emitNoticeGroups(this, ['desktop'])
    }
  }
}

// Desktop 앱은 @dfragon/lib 원본을 직접 번들하고 점수 엔진 바이너리도 함께 배포한다. Desktop UI 자산만 쓰는
// Web에 점수 엔진 고지가 붙지 않도록 desktopNotices와 나눈다.
export function desktopAppNotices() {
  return {
    name: 'dfragon-desktop-app-notices',
    generateBundle(this: AssetContext) {
      emitNoticeGroups(this, ['lib', 'score-engine'])
    }
  }
}
