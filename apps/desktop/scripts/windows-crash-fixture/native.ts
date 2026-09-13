import koffi from 'koffi'
import { relative } from 'node:path/win32'
import {
  createWindowsSecurityApiForTesting,
  createWindowsSecurityNative,
  type WindowsSecurityApi,
  type WindowsSecurityNative
} from '../../src/backend/auth/windows-security-native'
import type {
  WindowsCredentialFileHandle,
  WindowsCredentialNative,
  WindowsPathInspection
} from '../../src/backend/auth/credential-store/windows-credential-files'
import type { Observer } from './observer'

type NativeReturn = { call: string; outcome: string }
export function createObservedNative(
  observer: Observer,
  root: string
): {
  native: WindowsCredentialNative
  security: WindowsSecurityNative
  discardReadReturns(): void
} {
  const real = createWindowsSecurityApiForTesting((name) => koffi.load(name))
  const returns: NativeReturn[] = []
  const record = <T>(call: string, operation: () => T): T => {
    observer.assertActive()
    const result = operation()
    returns.push({ call, outcome: String(result) })
    return result
  }
  const api: WindowsSecurityApi = {
    ...real,
    createDirectory: (...args) => record('CreateDirectoryW', () => real.createDirectory(...args)),
    createFile: (...args) => record('CreateFileW', () => real.createFile(...args)),
    writeFile: (...args) => record('WriteFile', () => real.writeFile(...args)),
    flushFileBuffers: (...args) => record('FlushFileBuffers', () => real.flushFileBuffers(...args)),
    setFileInformationByHandle: (...args) => {
      const isRename = args[1] === 3
      const call = isRename
        ? 'SetFileInformationByHandle.FileRenameInfo'
        : 'SetFileInformationByHandle.FileDispositionInfo'
      return record(call, () => real.setFileInformationByHandle(...args))
    },
    closeHandle: (...args) => record('CloseHandle', () => real.closeHandle(...args))
  }
  const security = createWindowsSecurityNative({ api })
  const step = async <T>(cutpoint: string, path: string, operation: () => T): Promise<T> => {
    returns.length = 0
    await observer.observe({
      cutpoint,
      phase: 'before',
      outcome: 'not-called',
      detail: { path: relative(root, path) }
    })
    observer.assertActive()
    let result: T
    try {
      result = operation()
    } catch (error) {
      await observer.observe({
        cutpoint,
        phase: 'after',
        outcome: 'threw',
        detail: { path: relative(root, path), nativeReturns: returns.splice(0) }
      })
      throw error
    }
    await observer.observe({
      cutpoint,
      phase: 'after',
      outcome: 'returned',
      detail: { path: relative(root, path), nativeReturns: returns.splice(0) }
    })
    return result
  }
  const handle = (value: bigint, path: string): WindowsCredentialFileHandle => ({
    read: async (maximum) => {
      observer.assertActive()
      const bytes = Buffer.alloc(maximum)
      return bytes.subarray(0, security.readFile(value, bytes, maximum))
    },
    write: (data) => step('adapter.write', path, () => security.writeFile(value, data)),
    flush: () => step('adapter.flush', path, () => security.flushFileBuffers(value)),
    rename: (destination) =>
      step('adapter.rename', destination, () => security.renameFile(value, destination)),
    close: () =>
      step('adapter.close', path, () => {
        const closed = security.closeHandle(value)
        if (!closed) {
          throw new Error('Synthetic native handle close failed.')
        }
      })
  })
  const native: WindowsCredentialNative = {
    capabilities: {
      profileProtection: 'confirmed',
      fileMutation: 'confirmed',
      namespaceMutation: 'confirmed'
    },
    inspect: async (path, kind): Promise<WindowsPathInspection> => {
      observer.assertActive()
      const status = security.inspect(path, kind)
      const isTrusted = status === 'trusted'
      if (isTrusted) {
        return { status: kind === 'directory' ? 'trusted-directory' : 'trusted-file' }
      }
      return { status }
    },
    list: async (path) => {
      observer.assertActive()
      return security.list(path)
    },
    createDirectory: (path) =>
      step('adapter.create-directory', path, () => security.createDirectory(path)),
    createExclusive: async (path) =>
      handle(
        await step('adapter.create-exclusive', path, () => security.createExclusive(path)),
        path
      ),
    openRead: async (path) => {
      observer.assertActive()
      return handle(security.openRead(path), path)
    },
    remove: (path) => step('adapter.remove', path, () => security.remove(path)),
    syncDirectory: (path) =>
      step('adapter.sync-directory', path, () => security.syncDirectory(path))
  }
  return {
    native,
    security,
    discardReadReturns: () => {
      returns.length = 0
    }
  }
}

export type ReadOnlySecurity = Pick<
  WindowsSecurityNative,
  'inspect' | 'list' | 'openRead' | 'readFile' | 'closeHandle'
>
