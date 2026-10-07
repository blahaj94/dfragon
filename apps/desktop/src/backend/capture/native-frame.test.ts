import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bindWindowFrame } from './native-frame'

const mocks = vi.hoisted(() => ({ capture: vi.fn(), select: vi.fn(), report: vi.fn() }))
vi.mock('../lib/win32-window-capture', () => ({
  captureWindowClient: mocks.capture,
  selectWindowClient: mocks.select,
  WINDOW_CAPTURE_ERRORS: { COVERED: 'WINDOW_COVERED', ADMIN_REQUIRED: 'WINDOW_ADMIN_REQUIRED' }
}))
vi.mock('../diagnostics/log', () => ({ reportDiagnostic: mocks.report }))

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(process, 'platform', { value: 'win32' })
  mocks.select.mockReturnValue({ hwnd: 123n, pid: 1 })
})
afterEach(() => Object.defineProperty(process, 'platform', originalPlatform))

it('정상 네이티브 프레임은 그대로 반환하고 오류 기록을 만들지 않는다', () => {
  const rgba = Buffer.from([0, 0, 0, 255])
  mocks.capture.mockReturnValue({ width: 1, height: 1, rgba })
  expect(bindWindowFrame('synthetic-source')()).toEqual({
    kind: 'frame',
    image: { width: 1, height: 1, rgba }
  })
  expect(mocks.report).not.toHaveBeenCalled()
})

it.each([
  ['WINDOW_COVERED', 'covered', 'CAPTURE_COVERED'],
  ['WINDOW_ADMIN_REQUIRED', 'unavailable', 'CAPTURE_ADMIN_REQUIRED'],
  ['synthetic private native error', 'unavailable', 'CAPTURE_UNAVAILABLE']
])('네이티브 오류 %s는 기존 대기 상태와 정제된 코드로 전달한다', (message, reason, code) => {
  mocks.capture.mockImplementation(() => {
    throw new Error(message)
  })
  expect(bindWindowFrame('synthetic-source')()).toEqual({ kind: 'waiting', reason })
  expect(mocks.report).toHaveBeenCalledExactlyOnceWith(code)
})

it('창 선택 실패는 원문을 노출하지 않고 기존 캡처 오류를 유지한다', () => {
  mocks.select.mockImplementation(() => {
    throw new Error('synthetic private source')
  })
  expect(() => bindWindowFrame('synthetic-source')).toThrow('CAPTURE_UNAVAILABLE')
  expect(mocks.report).toHaveBeenCalledExactlyOnceWith('CAPTURE_SELECTION_FAILED')
})
