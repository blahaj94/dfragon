import { expect, it, vi } from 'vitest'
import { createWindowsProfileSecurity } from './windows-profile-native'

const native = vi.hoisted(() => ({
  inspect: vi.fn(() => 'trusted'),
  syncDirectory: vi.fn()
}))
vi.mock('./windows-security-native', () => ({
  createWindowsSecurityNative: () => native
}))

it('keeps root, ancestor and private policies distinct', () => {
  const security = createWindowsProfileSecurity()
  for (const [role, policy] of [
    ['root', 'root'],
    ['ancestor', 'ancestor'],
    ['final', 'private']
  ] as const) {
    expect(security.inspectDirectory('path', role)).toBe('trusted')
    expect(native.inspect).toHaveBeenLastCalledWith('path', 'directory', policy)
    security.syncDirectory('path', role)
    expect(native.syncDirectory).toHaveBeenLastCalledWith('path', policy)
  }
})
