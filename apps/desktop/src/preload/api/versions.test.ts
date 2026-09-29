import { beforeEach, expect, it, vi } from 'vitest'
import { getBuildVersions } from './versions'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('electron', () => ({ ipcRenderer: { invoke: mocks.invoke } }))
const snapshot = {
  desktop: { version: '1.2.3', commit: 'a'.repeat(40), dirty: false },
  servers: {
    api: { status: 'available', commit: null },
    accounts: { status: 'unsupported' },
    ocr: { status: 'unavailable' }
  }
}

beforeEach(() => vi.clearAllMocks())

it('exposes only a no-argument version query and validates its public snapshot', async () => {
  mocks.invoke.mockResolvedValue(snapshot)
  expect(await getBuildVersions()).toEqual(snapshot)
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('getBuildVersions')
})

it.each([
  { ...snapshot, secret: 'unexpected' },
  { ...snapshot, desktop: { ...snapshot.desktop, commit: `${'a'.repeat(40)}\n` } },
  { ...snapshot, servers: { ...snapshot.servers, ocr: { status: 'available', commit: 'short' } } }
])('rejects invalid IPC output without exposing it %j', async (body) => {
  mocks.invoke.mockResolvedValue(body)
  await expect(getBuildVersions()).rejects.toThrow('버전 정보의 응답을 확인하지 못했습니다.')
})
