import * as fs from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { MakeDirectoryOptions, Mode, PathLike, Stats } from 'node:fs'
import { vi } from 'vitest'

// Windows에 없는 POSIX flag는 이 합성 fixture의 module graph에만 보충한다.
vi.mock('node:fs', async (importOriginal) => {
  const native = await importOriginal<typeof import('node:fs')>()
  const isWindows = process.platform === 'win32'
  if (!isWindows) {
    return native
  }
  return {
    ...native,
    constants: { ...native.constants, O_NOFOLLOW: 0x20000000, O_DIRECTORY: 0x40000000 }
  }
})

// 먼저 로드된 test도 이 helper와 동일한 POSIX flag를 사용한다.
export const POSIX_TEST_FILE_CONSTANTS = constants

type Metadata = { mode: number; uid: number; target?: string }

// Windows의 POSIX 사례와 합성 경계 자체 검사에 사용한다. 내용·exclusive 생성·rename·unlink는 실제 IO다.
// Directory handle은 이 protocol이 사용하는 stat/sync/close만 모델링한다.
export function createPosixTestFiles({
  root,
  uid
}: Readonly<{ root: string; uid: number }>): typeof fs {
  const metadata = new Map<string, Metadata>([[root, { mode: 0o700, uid }]])

  function modeNumber(mode: Mode | undefined, fallback: number): number {
    const isString = typeof mode === 'string'
    return isString ? Number.parseInt(mode, 8) : (mode ?? fallback)
  }

  function withMetadata(stat: Stats, entry: Metadata | undefined): Stats {
    const hasMetadata = entry != null
    if (!hasMetadata) {
      return stat
    }
    const isLink = entry.target != null
    const isFile = stat.isFile()
    const isDirectory = stat.isDirectory()
    const isRegularFile = !isLink && isFile
    const isRealDirectory = !isLink && isDirectory
    return Object.assign(stat, {
      mode: (isLink ? constants.S_IFLNK : stat.mode & ~0o7777) | entry.mode,
      uid: entry.uid,
      isSymbolicLink: () => isLink,
      isFile: () => isRegularFile,
      isDirectory: () => isRealDirectory
    })
  }

  async function statPath(path: PathLike): Promise<Stats> {
    const stat = await fs.lstat(path)
    const entry = metadata.get(String(path))
    return withMetadata(stat, entry)
  }

  const files: typeof fs = {
    ...fs,
    lstat: statPath as typeof fs.lstat,
    mkdir: (async (path: PathLike, options?: MakeDirectoryOptions | Mode | null) => {
      const result = await fs.mkdir(path, options)
      const isOptionsObject = options != null && typeof options === 'object'
      const mode = isOptionsObject ? options.mode : (options ?? undefined)
      metadata.set(String(path), { mode: modeNumber(mode, 0o777), uid })
      return result
    }) as typeof fs.mkdir,
    chmod: async (path, mode) => {
      await fs.chmod(path, mode)
      const current = metadata.get(String(path))
      const updated = Object.assign(current ?? { uid }, { mode: modeNumber(mode, 0o777) })
      metadata.set(String(path), updated)
    },
    writeFile: async (path, data, options) => {
      await fs.writeFile(path, data, options)
      const isPath = typeof path === 'string'
      const hasMetadata = isPath && metadata.has(path)
      const shouldRecordMode = isPath && !hasMetadata
      if (shouldRecordMode) {
        const isOptionsObject = options != null && typeof options === 'object'
        const mode = isOptionsObject ? options.mode : undefined
        metadata.set(path, { mode: modeNumber(mode, 0o666), uid })
      }
    },
    symlink: async (target, path) => {
      await fs.writeFile(path, '', { flag: 'wx' })
      metadata.set(String(path), { mode: 0o777, uid, target: String(target) })
    },
    open: async (path, flags, mode) => {
      const entry = metadata.get(String(path))
      const isLink = entry?.target != null
      const isNumeric = typeof flags === 'number'
      const noFollow = isNumeric && (flags & constants.O_NOFOLLOW) !== 0
      const directoryOnly = isNumeric && (flags & constants.O_DIRECTORY) !== 0
      const rejectsLink = isLink && noFollow
      if (rejectsLink) {
        throw Object.assign(new Error('Synthetic nofollow rejected a link.'), { code: 'ELOOP' })
      }
      if (directoryOnly) {
        const stat = await statPath(path)
        const isDirectory = stat.isDirectory()
        if (!isDirectory) {
          throw Object.assign(new Error('Synthetic directory open rejected a file.'), {
            code: 'ENOTDIR'
          })
        }
        let closed = false
        const assertOpen = (): void => {
          if (closed) {
            throw Object.assign(new Error('Synthetic directory handle is closed.'), {
              code: 'EBADF'
            })
          }
        }
        // FileHandle의 사용 범위를 명시적으로 제한한다. 실제 Windows directory fsync를 주장하지 않는다.
        return {
          stat: async () => {
            assertOpen()
            return statPath(path)
          },
          sync: async () => {
            assertOpen()
          },
          close: async () => {
            closed = true
          },
          writeFile: async () => {
            throw new Error('Synthetic directory cannot be written.')
          }
        } as unknown as fs.FileHandle
      }
      const nativeFlags = isNumeric ? flags & ~constants.O_NOFOLLOW & ~constants.O_DIRECTORY : flags
      const target = isLink ? resolve(dirname(String(path)), entry.target!) : path
      const handle = await fs.open(target, nativeFlags, mode)
      const key = String(target)
      const hasMetadata = metadata.has(key)
      const isCreate = isNumeric && (flags & constants.O_CREAT) !== 0
      const shouldRecordCreation = !hasMetadata && isCreate
      if (shouldRecordCreation) {
        metadata.set(key, { mode: modeNumber(mode, 0o666), uid })
      }
      const handleMetadata = metadata.get(key)
      const stat = handle.stat.bind(handle)
      handle.stat = (async () => withMetadata(await stat(), handleMetadata)) as typeof handle.stat
      return handle
    },
    rename: async (from, to) => {
      await fs.rename(from, to)
      const entry = metadata.get(String(from))
      metadata.delete(String(from))
      metadata.delete(String(to))
      const hasEntry = entry != null
      if (hasEntry) {
        metadata.set(String(to), entry)
      }
    },
    unlink: async (path) => {
      await fs.unlink(path)
      metadata.delete(String(path))
    }
  }
  return files
}
