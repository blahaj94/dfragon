import { expect, it, vi } from 'vitest'
import { assertFixtureAncestors, assertPrivateRoot } from './isolation'
import type { ReadOnlySecurity } from './native'

const root = String.raw`C:\synthetic-lab\ldb-crash-root`
const plainDirectory = async () => ({ isDirectory: () => true, isSymbolicLink: () => false })

it('accepts plain system-owned ancestors without declaring their ACL trusted', async () => {
  const security = { inspect: vi.fn<ReadOnlySecurity['inspect']>(() => 'untrusted') }

  await expect(
    assertFixtureAncestors({ root, security, readType: plainDirectory })
  ).resolves.toBeUndefined()
  expect(security.inspect).toHaveBeenCalledWith(
    String.raw`C:\synthetic-lab`,
    'directory',
    'ancestor'
  )
  expect(security.inspect).toHaveBeenCalledWith('C:\\', 'directory', 'ancestor')
})

it.each(['reparse', 'missing', 'unavailable'] as const)(
  'rejects an ancestor reported as %s',
  async (status) => {
    const security = { inspect: vi.fn<ReadOnlySecurity['inspect']>(() => status) }

    await expect(
      assertFixtureAncestors({ root, security, readType: plainDirectory })
    ).rejects.toThrow()
  }
)

it.each(['file', 'symbolic-link'] as const)(
  'rejects %s ancestors before native inspection',
  async (kind) => {
    const security = { inspect: vi.fn<ReadOnlySecurity['inspect']>(() => 'untrusted') }
    const readType = async () => ({
      isDirectory: () => kind !== 'file',
      isSymbolicLink: () => kind === 'symbolic-link'
    })

    await expect(assertFixtureAncestors({ root, security, readType })).rejects.toThrow()
    expect(security.inspect).not.toHaveBeenCalled()
  }
)

it('requires the new native-created root itself to have private trusted protection', () => {
  const security = { inspect: vi.fn<ReadOnlySecurity['inspect']>(() => 'untrusted') }
  expect(() => assertPrivateRoot({ root, security })).toThrow()
  expect(security.inspect).toHaveBeenCalledWith(root, 'directory', 'private')

  security.inspect.mockReturnValue('trusted')
  expect(() => assertPrivateRoot({ root, security })).not.toThrow()
})
