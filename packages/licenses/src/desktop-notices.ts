import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const noticesRoot = fileURLToPath(new URL('../notices/desktop/', import.meta.url))

/** Preserve the existing Desktop asset notices after moving their originals. */
export function desktopNotices() {
  return {
    name: 'dfragon-desktop-notices',
    generateBundle(this: {
      emitFile(asset: { type: 'asset'; fileName: string; source: string }): unknown
    }) {
      for (const name of readdirSync(noticesRoot).sort()) {
        this.emitFile({
          type: 'asset',
          fileName: `notices/desktop/${name}`,
          source: readFileSync(join(noticesRoot, name), 'utf8')
        })
      }
    }
  }
}
