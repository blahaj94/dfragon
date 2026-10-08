import { expect, it, vi } from 'vitest'
import { createDiagnosticLog, registerMainDiagnosticErrors } from './log'
import { DIAGNOSTIC_HISTORY_LIMIT } from '../../preload/common/types/diagnostics'

it('연속해서 같은 오류가 발생하면 한 번만 기록하고 이후 다른 오류는 순서대로 남긴다', () => {
  const log = createDiagnosticLog()
  const receive = vi.fn()
  const unsubscribe = log.subscribe(receive)
  log.report('OCR_FAILED')
  log.report('OCR_FAILED')
  log.report('SEARCH_TIMEOUT')
  expect(log.history()).toEqual([
    { sequence: 1, timestamp: expect.any(Number), code: 'OCR_FAILED' },
    { sequence: 2, timestamp: expect.any(Number), code: 'SEARCH_TIMEOUT' }
  ])
  expect(receive).toHaveBeenCalledTimes(2)
  unsubscribe()
  log.report('UPLOAD_FAILED')
  expect(receive).toHaveBeenCalledTimes(2)
})

it('현재 실행의 최근 기록만 유지하며 반환 배열을 변경해도 내부 기록은 보존한다', () => {
  const log = createDiagnosticLog()
  for (let index = 0; index < DIAGNOSTIC_HISTORY_LIMIT + 2; index += 1) {
    log.report(index % 2 === 0 ? 'OCR_FAILED' : 'UPLOAD_FAILED')
  }
  const history = log.history()
  expect(history).toHaveLength(DIAGNOSTIC_HISTORY_LIMIT)
  expect(history[0].sequence).toBe(3)
  history.pop()
  expect(log.history()).toHaveLength(DIAGNOSTIC_HISTORY_LIMIT)
  expect(Object.isFrozen(log.history()[0])).toBe(true)
})

it('허용한 코드 외의 원문 값은 기록하지 않고 구독 예외도 작업에 전파하지 않는다', () => {
  const log = createDiagnosticLog()
  const receive = vi.fn()
  log.subscribe(() => {
    throw new Error('synthetic subscriber failure')
  })
  log.subscribe(receive)
  Reflect.apply(log.report, undefined, [new Error('synthetic private text')])
  Reflect.apply(log.report, undefined, ['https://synthetic.invalid/token'])
  log.report('CAPTURE_UNAVAILABLE')
  expect(log.history()).toHaveLength(1)
  expect(receive).toHaveBeenCalledWith({
    sequence: 1,
    timestamp: expect.any(Number),
    code: 'CAPTURE_UNAVAILABLE'
  })
})

it('메인 오류 관찰은 기본 종료 처리와 미처리 Promise 정책을 바꾸지 않는다', () => {
  const exceptionCount = process.listenerCount('uncaughtException')
  const rejectionCount = process.listenerCount('unhandledRejection')
  const monitorCount = process.listenerCount('uncaughtExceptionMonitor')
  const dispose = registerMainDiagnosticErrors()
  expect(process.listenerCount('uncaughtExceptionMonitor')).toBe(monitorCount + 1)
  expect(process.listenerCount('uncaughtException')).toBe(exceptionCount)
  expect(process.listenerCount('unhandledRejection')).toBe(rejectionCount)
  dispose()
  expect(process.listenerCount('uncaughtExceptionMonitor')).toBe(monitorCount)
})
