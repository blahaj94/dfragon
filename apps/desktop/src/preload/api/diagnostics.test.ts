import { beforeEach, expect, it, vi } from 'vitest'
import { getDiagnosticHistory, onDiagnosticEntry, reportRendererDiagnostic } from './diagnostics'
import { DIAGNOSTIC_CHANNELS } from '../common/types/diagnostics'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), on: vi.fn(), remove: vi.fn() }))
vi.mock('electron', () => ({
  ipcRenderer: { invoke: mocks.invoke, on: mocks.on, removeListener: mocks.remove }
}))
beforeEach(() => vi.clearAllMocks())

it('히스토리와 실시간 이벤트 모두 정제된 항목만 화면에 노출한다', async () => {
  const entry = { sequence: 1, timestamp: 1_000, code: 'OCR_FAILED' }
  mocks.invoke.mockResolvedValue([entry])
  expect(await getDiagnosticHistory()).toEqual([entry])
  mocks.invoke.mockResolvedValue([{ ...entry, raw: 'synthetic private payload' }])
  await expect(getDiagnosticHistory()).rejects.toThrow('INVALID_DIAGNOSTIC_RESPONSE')
  const receive = vi.fn()
  const unsubscribe = onDiagnosticEntry(receive)
  const handler = mocks.on.mock.calls[0][1] as (event: unknown, value: unknown) => void
  handler({}, entry)
  handler({}, { ...entry, raw: 'synthetic private payload' })
  expect(receive).toHaveBeenCalledExactlyOnceWith(entry)
  unsubscribe()
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(DIAGNOSTIC_CHANNELS.entry, handler)
})

it('보고용 preload도 알 수 없는 문자열과 원문 오류를 전송하지 않는다', async () => {
  mocks.invoke.mockResolvedValue(undefined)
  await reportRendererDiagnostic('OCR_FAILED')
  await expect(
    Reflect.apply(reportRendererDiagnostic, undefined, ['MAIN_PROCESS_FAILED'])
  ).rejects.toThrow('INVALID_DIAGNOSTIC_COMMAND')
  await expect(
    Reflect.apply(reportRendererDiagnostic, undefined, [new Error('synthetic private payload')])
  ).rejects.toThrow('INVALID_DIAGNOSTIC_COMMAND')
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(DIAGNOSTIC_CHANNELS.report, 'OCR_FAILED')
})
