import { lstat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import { dirname } from 'node:path/win32'
import type { ReadOnlySecurity } from './native'

type Inspection = Pick<ReadOnlySecurity, 'inspect'>

// Match the existing windows-security-fixture plain-directory/reparse check.
// Ancestor ACL trust is not claimed; only the new private root is ACL-trusted.
export async function assertFixtureAncestors({
  root,
  security,
  readType = lstat
}: {
  root: string
  security: Inspection
  readType?(path: string): Promise<Pick<Stats, 'isDirectory' | 'isSymbolicLink'>>
}): Promise<void> {
  let path = dirname(root)
  while (true) {
    const information = await readType(path)
    const isDirectory = information.isDirectory()
    const isLink = information.isSymbolicLink()
    const isPlainDirectory = isDirectory && !isLink
    if (!isPlainDirectory) {
      throw new Error('Synthetic fixture ancestor is not a plain directory.')
    }
    const inspection = security.inspect(path, 'directory', 'ancestor')
    const isStructurallyObserved = inspection === 'trusted' || inspection === 'untrusted'
    if (!isStructurallyObserved) {
      throw new Error('Synthetic fixture ancestor structure is unconfirmed.')
    }
    const parent = dirname(path)
    const isVolume = parent === path
    if (isVolume) {
      return
    }
    path = parent
  }
}

export function assertPrivateRoot({
  root,
  security
}: {
  root: string
  security: Inspection
}): void {
  const inspection = security.inspect(root, 'directory', 'private')
  const isPrivateTrusted = inspection === 'trusted'
  if (!isPrivateTrusted) {
    throw new Error('New synthetic root private protection is unconfirmed.')
  }
}
