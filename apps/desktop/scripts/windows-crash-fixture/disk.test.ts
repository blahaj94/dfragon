import { expect, it, vi } from 'vitest'
import { observeDisk } from './disk'
import type { ReadOnlySecurity } from './native'

const root = String.raw`C:\synthetic-root`
function securityFixture(): ReadOnlySecurity & { createDirectory: ReturnType<typeof vi.fn> } {
  return {
    inspect: vi.fn((path, kind) => {
      const isRoot = path === root
      const isDirectory = kind === 'directory'
      return isRoot === isDirectory ? 'trusted' : 'untrusted'
    }),
    list: vi.fn(() => ['credential.v1']),
    openRead: vi.fn(() => 1n),
    readFile: vi.fn((_handle, bytes) => {
      bytes.write('synthetic')
      return 9
    }),
    closeHandle: vi.fn(() => true),
    createDirectory: vi.fn()
  }
}

it('captures original bytes and protection without creating or removing files', () => {
  const security = securityFixture()
  const result = observeDisk(security, root)

  expect(result.entries).toEqual([
    { name: '.', type: 'directory', protection: 'trusted' },
    {
      name: './credential.v1',
      type: 'file',
      protection: 'trusted',
      bytes: Buffer.from('synthetic').toString('base64'),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
    }
  ])
  expect(security.createDirectory).not.toHaveBeenCalled()
  expect(security.closeHandle).toHaveBeenCalledOnce()
})

it.each(['reparse', 'untrusted', 'unavailable'] as const)(
  'rejects %s original protection without an empty result',
  (status) => {
    const security = securityFixture()
    vi.mocked(security.inspect).mockReturnValue(status)

    expect(() => observeDisk(security, root)).toThrow('unconfirmed')
    expect(security.createDirectory).not.toHaveBeenCalled()
    expect(security.openRead).not.toHaveBeenCalled()
  }
)

it('rejects unexpected names and oversized records while retaining the original', () => {
  const security = securityFixture()
  vi.mocked(security.list).mockReturnValue(['unexpected'])
  expect(() => observeDisk(security, root)).toThrow('unexpected')
  expect(security.openRead).not.toHaveBeenCalled()

  vi.mocked(security.list).mockReturnValue(['credential.v1'])
  vi.mocked(security.readFile).mockImplementation((_handle, bytes) => bytes.length)
  expect(() => observeDisk(security, root)).toThrow('bound')
  expect(security.closeHandle).toHaveBeenCalledOnce()
  expect(security.createDirectory).not.toHaveBeenCalled()
})
