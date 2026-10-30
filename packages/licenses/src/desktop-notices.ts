import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const noticesRoot = fileURLToPath(new URL('../notices/', import.meta.url))
// Desktop은 @dfragon/lib 원본을 직접 번들하고 점수 엔진 바이너리도 함께 배포하므로 두 고지도 낸다.
const DESKTOP_NOTICE_GROUPS = ['desktop', 'lib', 'score-engine']

export function desktopNotices() {
  return {
    name: 'dfragon-desktop-notices',
    generateBundle(this: {
      emitFile(asset: { type: 'asset'; fileName: string; source: string }): unknown
    }) {
      for (const group of DESKTOP_NOTICE_GROUPS) {
        const groupRoot = join(noticesRoot, group)
        for (const name of readdirSync(groupRoot).sort()) {
          this.emitFile({
            type: 'asset',
            fileName: `notices/${group}/${name}`,
            source: readFileSync(join(groupRoot, name), 'utf8')
          })
        }
      }
    }
  }
}
