import * as fs from 'node:fs'
import { dirname, resolve } from 'node:path'

type RuntimeProfileTestFilesystem = Omit<typeof fs, 'chmodSync' | 'symlinkSync' | 'openSync'> & {
  chmodSync(path: fs.PathLike, mode: number): void
  symlinkSync(target: fs.PathLike, path: fs.PathLike): void
  openSync(path: fs.PathLike, flags: number): number
  registerRoot(root: string): void
}

// Windows exercises the POSIX policy against real paths with modeled POSIX metadata.
// Native POSIX runs retain the actual metadata and directory durability operations.
export function createRuntimeProfileTestFilesystem(
  modelPosix = process.platform === 'win32'
): RuntimeProfileTestFilesystem {
  const metadata = new Map<string, { mode: number; uid: number }>()
  const directoryHandles = new Set<number>()
  let nextHandle = -1

  function remember(path: fs.PathLike, mode: number): void {
    metadata.set(resolve(String(path)), { mode, uid: process.getuid?.() ?? 0 })
  }

  function lstatSync(path: fs.PathLike): fs.Stats {
    const stat = fs.lstatSync(path)
    const isDirectory = stat.isDirectory()
    const shouldUseNativeStat = !modelPosix || !isDirectory
    if (shouldUseNativeStat) {
      return stat
    }
    const protection = metadata.get(resolve(String(path)))
    const isProtectionMissing = protection == null
    if (isProtectionMissing) {
      throw new Error('POSIX profile fixture metadata was not registered')
    }
    return Object.assign(stat, {
      uid: protection.uid,
      mode: (stat.mode & ~0o7777) | protection.mode
    })
  }

  function registerRoot(root: string): void {
    if (!modelPosix) {
      return
    }
    let ancestor = root
    while (true) {
      // Only the explicit fixture root and its real ancestors are trusted setup inputs.
      const stat = fs.lstatSync(ancestor)
      const isDirectory = stat.isDirectory()
      const isLink = stat.isSymbolicLink()
      const isInvalidAncestor = !isDirectory || isLink
      if (isInvalidAncestor) {
        throw new Error('POSIX profile fixture root must have real directory ancestors')
      }
      remember(ancestor, 0o700)
      const parent = dirname(ancestor)
      const isFilesystemRoot = parent === ancestor
      if (isFilesystemRoot) {
        return
      }
      ancestor = parent
    }
  }

  function mkdirSync(path: fs.PathLike, options: { mode: number }): void {
    fs.mkdirSync(path, options)
    remember(path, options.mode)
  }

  function chmodSync(path: fs.PathLike, mode: number): void {
    fs.chmodSync(path, mode)
    const key = resolve(String(path))
    const protection = metadata.get(key)
    const isProtectionMissing = protection == null
    if (modelPosix && isProtectionMissing) {
      throw new Error('POSIX profile fixture metadata was not registered')
    }
    if (protection != null) {
      metadata.set(key, { ...protection, mode })
    }
  }

  function symlinkSync(target: fs.PathLike, path: fs.PathLike): void {
    const isWindows = process.platform === 'win32'
    const type = isWindows ? 'junction' : 'dir'
    fs.symlinkSync(target, path, type)
    const isLink = fs.lstatSync(path).isSymbolicLink()
    if (!isLink) {
      throw new Error('Profile fixture directory link was not created')
    }
    remember(path, 0o700)
  }

  function openSync(path: fs.PathLike, flags: number): number {
    if (!modelPosix) {
      return fs.openSync(path, flags)
    }
    const stat = lstatSync(path)
    const isDirectory = stat.isDirectory()
    const isLink = stat.isSymbolicLink()
    const isInvalidDirectory = !isDirectory || isLink
    if (isInvalidDirectory) {
      throw new Error('Profile fixture directory handle requires a real directory')
    }
    const handle = nextHandle--
    directoryHandles.add(handle)
    return handle
  }

  function fsyncSync(handle: number): void {
    if (!modelPosix) {
      fs.fsyncSync(handle)
      return
    }
    const isOpen = directoryHandles.has(handle)
    if (!isOpen) {
      throw new Error('Profile fixture directory handle is not open')
    }
  }

  function closeSync(handle: number): void {
    if (!modelPosix) {
      fs.closeSync(handle)
      return
    }
    const wasOpen = directoryHandles.delete(handle)
    if (!wasOpen) {
      throw new Error('Profile fixture directory handle is not open')
    }
  }

  return {
    ...fs,
    lstatSync: lstatSync as typeof fs.lstatSync,
    mkdirSync: mkdirSync as typeof fs.mkdirSync,
    chmodSync,
    symlinkSync,
    openSync,
    fsyncSync,
    closeSync,
    registerRoot
  }
}
