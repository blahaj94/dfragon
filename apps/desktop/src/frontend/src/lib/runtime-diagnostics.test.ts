// @vitest-environment jsdom
import { afterEach, expect, it, vi, type Mock, type MockInstance } from 'vitest'
import { reportRendererDiagnostic, startRendererDiagnostics } from './runtime-diagnostics'
import type { DiagnosticApi, DiagnosticEntry } from '../../../preload/common/types/diagnostics'

let dispose: (() => void) | undefined
afterEach(() => {
  dispose?.()
  vi.restoreAllMocks()
})

function fixture(): {
  send: (entry: DiagnosticEntry) => void
  resolveHistory: (history: DiagnosticEntry[]) => void
  history: Promise<DiagnosticEntry[]>
  unsubscribe: Mock
  report: Mock<DiagnosticApi['reportRendererDiagnostic']>
  warn: MockInstance<typeof console.warn>
} {
  let send!: (entry: DiagnosticEntry) => void
  let resolveHistory!: (history: DiagnosticEntry[]) => void
  const history = new Promise<DiagnosticEntry[]>((resolve) => {
    resolveHistory = resolve
  })
  const unsubscribe = vi.fn()
  const report = vi.fn<DiagnosticApi['reportRendererDiagnostic']>().mockResolvedValue()
  const api: DiagnosticApi = {
    getDiagnosticHistory: () => history,
    reportRendererDiagnostic: report,
    onDiagnosticEntry: (listener) => {
      send = listener

      return unsubscribe
    }
  }
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  dispose = startRendererDiagnostics(api)

  return { send, resolveHistory, history, unsubscribe, report, warn }
}

it('과거 기록과 동시에 도착한 이벤트를 시간순으로 한 번만 Console에 표시한다', async () => {
  const f = fixture()
  const first: DiagnosticEntry = { sequence: 1, timestamp: 1_000, code: 'OCR_FAILED' }
  const second: DiagnosticEntry = { sequence: 2, timestamp: 2_000, code: 'SEARCH_TIMEOUT' }
  f.send(second)
  f.resolveHistory([first, second])
  await vi.waitFor(() => expect(f.warn).toHaveBeenCalledTimes(2))
  expect(f.warn.mock.calls[0][0]).toContain('OCR_FAILED: 닉네임 인식을 완료하지 못했습니다.')
  expect(f.warn.mock.calls[1][0]).toContain('SEARCH_TIMEOUT: 캐릭터 조회 시간이 초과되었습니다.')
  f.send(second)
  expect(f.warn).toHaveBeenCalledTimes(2)
})

it('화면 원문 오류와 거부 이유를 읽지 않고 분류된 코드만 보고한다', () => {
  const f = fixture()
  const error = new Event('error')
  Object.defineProperty(error, 'message', {
    get: () => {
      throw new Error('must not read raw error')
    }
  })
  window.dispatchEvent(error)
  window.dispatchEvent(new Event('unhandledrejection'))
  reportRendererDiagnostic('CAPTURE_START_FAILED')
  expect(f.report.mock.calls).toEqual([
    ['RENDERER_ERROR'],
    ['RENDERER_REJECTION'],
    ['CAPTURE_START_FAILED']
  ])
})

it('종료 시 구독과 화면 오류 관찰을 정리하고 늦은 히스토리를 표시하지 않는다', async () => {
  const f = fixture()
  window.dispatchEvent(new Event('pagehide'))
  dispose?.()
  f.resolveHistory([{ sequence: 1, timestamp: 1_000, code: 'OCR_FAILED' }])
  await f.history
  window.dispatchEvent(new Event('error'))
  reportRendererDiagnostic('OCR_FAILED')
  expect(f.unsubscribe).toHaveBeenCalledOnce()
  expect(f.warn).not.toHaveBeenCalled()
  expect(f.report).not.toHaveBeenCalled()
})

it('진단 전송 실패는 새 미처리 rejection을 만들지 않는다', async () => {
  const f = fixture()
  f.report.mockRejectedValue(new Error('synthetic bridge unavailable'))
  reportRendererDiagnostic('OCR_FAILED')
  await Promise.resolve()
  expect(f.report).toHaveBeenCalledWith('OCR_FAILED')
})
