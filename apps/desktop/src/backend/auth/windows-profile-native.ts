import { createWindowsSecurityNative } from './windows-security-native'

export type WindowsProfilePathInspection =
  'missing' | 'trusted' | 'reparse' | 'untrusted' | 'unavailable'

export type WindowsProfileSecurity = Readonly<{
  inspectDirectory(path: string, role: 'root' | 'ancestor' | 'final'): WindowsProfilePathInspection
  createDirectory(path: string): 'created' | 'already-exists'
  syncDirectory(path: string, role?: 'root' | 'ancestor' | 'final'): void
}>

export function createWindowsProfileSecurity(): WindowsProfileSecurity {
  const native = createWindowsSecurityNative()
  return {
    inspectDirectory: (path, role) =>
      native.inspect(path, 'directory', role === 'final' ? 'private' : role),
    createDirectory: (path) => native.createDirectory(path),
    syncDirectory: (path, role = 'final') =>
      native.syncDirectory(path, role === 'final' ? 'private' : role)
  }
}
