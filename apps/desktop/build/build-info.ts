import { execFileSync } from 'node:child_process'

export type DesktopSourceInfo = Readonly<{ commit: string | null; dirty: boolean | null }>

const SOURCE_COMMIT_PATTERN = /^[0-9a-f]{40}$/

/** Snapshot the checked-out source during bundling; runtime environment variables cannot change it. */
export function readDesktopSourceInfo(
  directory: string,
  runGit: (args: string[]) => string = (args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
): DesktopSourceInfo {
  try {
    const commit = runGit(['rev-parse', '--verify', 'HEAD^{commit}']).trim()
    if (commit.length !== 40 || !SOURCE_COMMIT_PATTERN.test(commit)) {
      return { commit: null, dirty: null }
    }
    const changes = runGit(['status', '--porcelain', '--untracked-files=normal'])
    const dirty = changes.length > 0

    return { commit, dirty }
  } catch {
    return { commit: null, dirty: null }
  }
}
