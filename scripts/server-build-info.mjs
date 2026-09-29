import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Record the source revision supplied by the image builder, never runtime environment values. */
export function createServerBuildInfo(service, commit) {
  if (!['api', 'accounts', 'ocr'].includes(service)) {
    throw new Error('Expected an API, accounts, or OCR service.')
  }
  if (
    typeof commit !== 'string' ||
    (commit !== '' && (commit.length !== 40 || !/^[0-9a-f]{40}$/.test(commit)))
  ) {
    throw new Error('Source commit must be a full lowercase Git SHA.')
  }
  return { service, commit: commit === '' ? null : commit }
}

function main() {
  if (process.argv.length !== 5) {
    throw new Error('Usage: server-build-info.mjs <service> <source-commit-or-empty> <output>')
  }
  const [, , service, commit, output] = process.argv
  const info = createServerBuildInfo(service, commit)
  writeFileSync(output, JSON.stringify(info) + '\n', { mode: 0o644 })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
