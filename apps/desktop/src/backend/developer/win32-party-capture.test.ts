import { describe, expect, it, vi } from 'vitest'
import {
  assertShortcutProcessAccess,
  hasValidDetectedPartySlots,
  isDnfExecutablePath,
  partySlotCoverageIntersectsWindow,
  type ShortcutAccessApi
} from './win32-party-capture'

const coverage = { x: 42, y: 27, width: 99, height: 9 }
const client = { x: 300, y: 200, width: 1920, height: 1080 }

function detectedSlot(
  slot: 1 | 2 | 3 | 4,
  x = slot * 10
): {
  slot: 1 | 2 | 3 | 4
  x: number
  y: number
  width: number
  height: number
  coverage: { x: number; y: number; width: number; height: number }
} {
  return {
    slot,
    x,
    y: 10,
    width: 10,
    height: 10,
    coverage: { x, y: 20, width: 10, height: 9 }
  }
}

describe('Win32 party capture geometry guards', () => {
  it('identifies only DNF.exe-owned windows across Windows path casing', () => {
    expect(isDnfExecutablePath('C:\\Games\\DNF.exe')).toBe(true)
    expect(isDnfExecutablePath('D:\\Games\\d n f.exe')).toBe(false)
    expect(isDnfExecutablePath('C:\\Games\\launcher.exe')).toBe(false)
  })

  it('uses explicit client-space coverage with exclusive right and bottom edges', () => {
    expect(
      partySlotCoverageIntersectsWindow(client, coverage, {
        left: 440,
        top: 235,
        right: 441,
        bottom: 236
      })
    ).toBe(true)
    expect(
      partySlotCoverageIntersectsWindow(client, coverage, {
        left: 441,
        top: 236,
        right: 450,
        bottom: 245
      })
    ).toBe(false)
    expect(
      partySlotCoverageIntersectsWindow(client, coverage, {
        left: 900,
        top: 500,
        right: 1200,
        bottom: 700
      })
    ).toBe(false)
  })

  it('accepts sparse partial detections and rejects empty, duplicate, or out-of-bounds slots', () => {
    expect(hasValidDetectedPartySlots([detectedSlot(1)], 100, 100)).toBe(true)
    expect(hasValidDetectedPartySlots([detectedSlot(1), detectedSlot(3)], 100, 100)).toBe(true)
    expect(
      hasValidDetectedPartySlots(
        [detectedSlot(1), detectedSlot(2), detectedSlot(3), detectedSlot(4)],
        100,
        100
      )
    ).toBe(true)

    expect(hasValidDetectedPartySlots([], 100, 100)).toBe(false)
    expect(hasValidDetectedPartySlots([detectedSlot(1), detectedSlot(1, 20)], 100, 100)).toBe(false)
    expect(hasValidDetectedPartySlots([detectedSlot(2, 95)], 100, 100)).toBe(false)
    expect(
      hasValidDetectedPartySlots(
        [{ ...detectedSlot(2), coverage: { x: 95, y: 20, width: 10, height: 9 } }],
        100,
        100
      )
    ).toBe(false)
  })
})

function shortcutAccessApi(gameElevated = false, appElevated = false): ShortcutAccessApi {
  return {
    OpenProcess: vi.fn(() => 10n),
    GetCurrentProcess: vi.fn(() => -1n),
    OpenProcessToken: vi.fn((processHandle, _access, output) => {
      output[0] = processHandle === 10n ? 20n : 30n
      return 1
    }),
    GetTokenInformation: vi.fn((token, _informationClass, output, _length, returnLength) => {
      output.writeUInt32LE(Number(token === 20n ? gameElevated : appElevated), 0)
      returnLength[0] = 4
      return 1
    }),
    CloseHandle: vi.fn(() => 1)
  }
}

describe('DNF shortcut elevation access', () => {
  it.each([
    [false, false],
    [false, true],
    [true, true]
  ])('allows game elevation %s with app elevation %s', (gameElevated, appElevated) => {
    const api = shortcutAccessApi(gameElevated, appElevated)
    expect(() => assertShortcutProcessAccess(api, 123)).not.toThrow()
    expect(api.OpenProcess).toHaveBeenCalledWith(0x1000, 0, 123)
    expect(api.OpenProcessToken).toHaveBeenCalledWith(10n, 0x8, [20n])
    expect(api.GetTokenInformation).toHaveBeenCalledWith(20n, 20, expect.any(Buffer), 4, [4])
    expect(vi.mocked(api.CloseHandle).mock.calls).toEqual([[20n], [30n], [10n]])
  })

  it('rejects an elevated game with a standard app after closing all owned handles', () => {
    const api = shortcutAccessApi(true, false)
    expect(() => assertShortcutProcessAccess(api, 123)).toThrow('DEVELOPER_ADMIN_REQUIRED')
    expect(vi.mocked(api.CloseHandle).mock.calls).toEqual([[20n], [30n], [10n]])
  })

  it('fails closed when the game process cannot be opened', () => {
    const api = shortcutAccessApi()
    vi.mocked(api.OpenProcess).mockReturnValue(null)
    expect(() => assertShortcutProcessAccess(api, 123)).toThrow('DEVELOPER_CAPTURE_UNAVAILABLE')
    expect(api.OpenProcessToken).not.toHaveBeenCalled()
    expect(api.CloseHandle).not.toHaveBeenCalled()
  })

  it.each([10n, -1n])(
    'cleans up when the token for process %s cannot be opened',
    (processHandle) => {
      const api = shortcutAccessApi()
      vi.mocked(api.OpenProcessToken).mockImplementation((process, _access, output) => {
        if (process === processHandle) {
          return 0
        }
        output[0] = 20n
        return 1
      })
      expect(() => assertShortcutProcessAccess(api, 123)).toThrow('DEVELOPER_CAPTURE_UNAVAILABLE')
      expect(vi.mocked(api.CloseHandle).mock.calls).toEqual(
        processHandle === 10n ? [[10n]] : [[20n], [10n]]
      )
    }
  )

  it.each(['failed', 'truncated', 'throwing'])(
    'sanitizes a %s token query and closes its handles',
    (failure) => {
      const api = shortcutAccessApi()
      vi.mocked(api.GetTokenInformation).mockImplementation(
        (_token, _type, _output, _length, size) => {
          if (failure === 'throwing') {
            throw new Error('native query details')
          }
          size[0] = failure === 'truncated' ? 0 : 4
          return failure === 'failed' ? 0 : 1
        }
      )
      expect(() => assertShortcutProcessAccess(api, 123)).toThrow('DEVELOPER_CAPTURE_UNAVAILABLE')
      expect(vi.mocked(api.CloseHandle).mock.calls).toEqual([[20n], [10n]])
    }
  )

  it.each([20n, 30n, 10n])(
    'does not report success or mismatch if handle %s cleanup fails',
    (handle) => {
      const api = shortcutAccessApi(true, false)
      vi.mocked(api.CloseHandle).mockImplementation((candidate) => (candidate === handle ? 0 : 1))
      expect(() => assertShortcutProcessAccess(api, 123)).toThrow('DEVELOPER_CAPTURE_UNAVAILABLE')
      expect(api.CloseHandle).toHaveBeenCalledWith(10n)
      expect(api.CloseHandle).not.toHaveBeenCalledWith(-1n)
    }
  )
})
