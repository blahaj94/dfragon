import { isDiagnosticCode } from '../../preload/common/diagnostics'
import {
  DIAGNOSTIC_HISTORY_LIMIT,
  type DiagnosticCode,
  type DiagnosticEntry
} from '../../preload/common/types/diagnostics'

export type DiagnosticLog = Readonly<{
  report: (code: DiagnosticCode) => void
  history: () => DiagnosticEntry[]
  subscribe: (listener: (entry: DiagnosticEntry) => void) => () => void
}>

/** 현재 프로세스의 진단 코드만 보관한다. 원문 오류와 요청 데이터는 받지 않는다. */
export function createDiagnosticLog(): DiagnosticLog {
  const entries: DiagnosticEntry[] = []
  const listeners = new Set<(entry: DiagnosticEntry) => void>()
  let sequence = 0

  function report(code: DiagnosticCode): void {
    if (!isDiagnosticCode(code) || entries.at(-1)?.code === code) {
      return
    }
    sequence += 1
    const timestamp = Date.now()
    const entry = Object.freeze({ sequence, timestamp, code })
    entries.push(entry)
    if (entries.length > DIAGNOSTIC_HISTORY_LIMIT) {
      entries.shift()
    }
    for (const listener of listeners) {
      try {
        listener(entry)
      } catch {
        // 진단 구독 실패가 캡처와 조회의 결과를 바꾸지 않는다.
      }
    }
  }

  function history(): DiagnosticEntry[] {
    return entries.slice()
  }

  function subscribe(listener: (entry: DiagnosticEntry) => void): () => void {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  return { report, history, subscribe }
}

export const diagnosticLog = createDiagnosticLog()
export const reportDiagnostic = diagnosticLog.report

/** 종료 동작을 바꾸지 않고 처리되지 않은 메인 프로세스 오류만 관찰한다. */
export function registerMainDiagnosticErrors(): () => void {
  const reportFailure = (): void => reportDiagnostic('MAIN_PROCESS_FAILED')
  process.on('uncaughtExceptionMonitor', reportFailure)

  return () => {
    process.removeListener('uncaughtExceptionMonitor', reportFailure)
  }
}
