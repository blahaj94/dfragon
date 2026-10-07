import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureWindowClient,
  selectWindowClient,
  windowHandleFromSource,
  WINDOW_CAPTURE_ERRORS
} from './win32-window-capture'

const native = vi.hoisted(() => ({
  calls: [] as string[],
  pid: 42,
  covered: 'none' as 'none' | 'partial' | 'full',
  failCopy: false,
  width: 120,
  height: 90
}))
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!

vi.mock('node:module', () => {
  const WINDOWS_FUNCTION_NAME_PATTERN = /\b([A-Za-z][A-Za-z0-9_]*)\(/
  const functions = {
    SetThreadDpiAwarenessContext: () => 100n,
    IsWindowVisible: () => 1,
    IsIconic: () => 0,
    DwmGetWindowAttribute: (_hwnd: bigint, _attribute: number, buffer: Buffer) => {
      buffer.writeUInt32LE(0)

      return 0
    },
    GetWindowThreadProcessId: (_hwnd: bigint, pid: number[]) => {
      pid[0] = native.pid

      return 1
    },
    GetClientRect: (_hwnd: bigint, rect: Buffer) => {
      rect.writeInt32LE(native.width, 8)
      rect.writeInt32LE(native.height, 12)

      return 1
    },
    ClientToScreen: (_hwnd: bigint, point: Buffer) => {
      point.writeInt32LE(100, 0)
      point.writeInt32LE(100, 4)

      return 1
    },
    GetWindow: (hwnd: bigint) => {
      if (hwnd === 123n && native.covered !== 'none') {
        return 999n
      }

      return null
    },
    GetWindowRect: (_hwnd: bigint, rect: Buffer) => {
      const full = native.covered === 'full'
      rect.writeInt32LE(full ? 100 : 110, 0)
      rect.writeInt32LE(full ? 100 : 110, 4)
      rect.writeInt32LE(full ? 220 : 130, 8)
      rect.writeInt32LE(full ? 190 : 130, 12)

      return 1
    },
    GetSystemMetrics: (index: number) => {
      if (index === 78) {
        return 1920
      }

      if (index === 79) {
        return 1080
      }

      return 0
    },
    GetDC: () => 10n,
    CreateCompatibleDC: () => 20n,
    CreateDIBSection: (_dc: bigint, _info: Buffer, _usage: number, bits: bigint[]) => {
      bits[0] = 30n

      return 40n
    },
    SelectObject: () => 50n,
    BitBlt: () => Number(!native.failCopy),
    GdiFlush: () => 1,
    DeleteDC: () => 1,
    DeleteObject: () => 1,
    ReleaseDC: () => 1,
    GetLastError: () => 5
  }
  const koffi = {
    load: () => ({
      func: (signature: string, overloadedName?: string) => {
        const name =
          signature === '__stdcall'
            ? overloadedName
            : WINDOWS_FUNCTION_NAME_PATTERN.exec(signature)?.[1]

        return (...args: unknown[]) => {
          if (name === undefined || !(name in functions)) {
            throw new Error('Unexpected native call')
          }
          native.calls.push(name)
          const callback = functions[name as keyof typeof functions]

          return Reflect.apply(callback, null, args)
        }
      }
    }),
    proto: () => ({}),
    pointer: () => ({}),
    decode: () => new Uint8Array(native.width * native.height * 4)
  }

  return { createRequire: () => () => koffi }
})

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32' })
  native.calls = []
  native.pid = 42
  native.covered = 'none'
  native.failCopy = false
  native.width = 120
  native.height = 90
})
afterEach(() => Object.defineProperty(process, 'platform', originalPlatform))

describe('공통 Windows 창 캡처', () => {
  it.each(['screen:1:0', 'window:0:0', 'window:123:0\n', 'window:18446744073709551616:0'])(
    '창 ID %s는 네이티브 접근 전에 거절한다',
    (value) => {
      expect(() => windowHandleFromSource(value)).toThrow(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
      expect(native.calls).toEqual([])
    }
  )

  it('선택한 창의 GDI 픽셀을 복사하고 모든 자원과 DPI를 복원한다', () => {
    const target = selectWindowClient('window:123:0')
    const frame = captureWindowClient(target)

    expect(frame).toMatchObject({ width: 120, height: 90, coveredRegions: [] })
    expect(frame.rgba.byteLength).toBe(120 * 90 * 4)
    expect([...frame.rgba.subarray(0, 4)]).toEqual([0, 0, 0, 255])
    expect(
      native.calls.filter((name) => ['DeleteDC', 'DeleteObject', 'ReleaseDC'].includes(name))
    ).toEqual(['DeleteDC', 'DeleteObject', 'ReleaseDC'])
    expect(native.calls.at(-1)).toBe('SetThreadDpiAwarenessContext')
  })

  it('다른 프로세스가 같은 창 핸들을 재사용하면 픽셀을 읽지 않는다', () => {
    const target = selectWindowClient('window:123:0')
    native.pid = 43

    expect(() => captureWindowClient(target)).toThrow(WINDOW_CAPTURE_ERRORS.NOT_FOUND)
    expect(native.calls).not.toContain('BitBlt')
    expect(native.calls.at(-1)).toBe('SetThreadDpiAwarenessContext')
  })

  it('다른 창이 클라이언트 영역을 가리면 화면 복사를 시작하지 않는다', () => {
    const target = selectWindowClient('window:123:0')
    native.covered = 'full'

    expect(() => captureWindowClient(target)).toThrow(WINDOW_CAPTURE_ERRORS.COVERED)
    expect(native.calls).not.toContain('GetDC')
    expect(native.calls.at(-1)).toBe('SetThreadDpiAwarenessContext')
  })

  it('일부 가림은 다른 창의 픽셀만 제외하고 보이는 게임 영역을 유지한다', () => {
    const target = selectWindowClient('window:123:0')
    native.covered = 'partial'
    const frame = captureWindowClient(target)
    const coveredOffset = (10 * 120 + 10) * 4

    expect([...frame.rgba.subarray(coveredOffset, coveredOffset + 4)]).toEqual([0, 0, 0, 0])
    expect([...frame.rgba.subarray(0, 4)]).toEqual([0, 0, 0, 255])
  })

  it('화면 복사 실패에도 GDI 자원과 DPI를 정리한다', () => {
    const target = selectWindowClient('window:123:0')
    native.failCopy = true

    expect(() => captureWindowClient(target)).toThrow('BitBlt(client)')
    expect(
      native.calls.filter((name) => ['DeleteDC', 'DeleteObject', 'ReleaseDC'].includes(name))
    ).toEqual(['DeleteDC', 'DeleteObject', 'ReleaseDC'])
    expect(native.calls.at(-1)).toBe('SetThreadDpiAwarenessContext')
  })
})
