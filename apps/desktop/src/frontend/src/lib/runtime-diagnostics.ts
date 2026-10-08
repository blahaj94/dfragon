import {
  DIAGNOSTIC_MESSAGES,
  DIAGNOSTIC_HISTORY_LIMIT,
  type DiagnosticApi,
  type DiagnosticEntry,
  type RendererDiagnosticCode
} from '../../../preload/common/types/diagnostics'

let activeApi: DiagnosticApi | null = null

/** 실행 경계에서 정제한 코드만 전달하고 진단 실패는 제품 동작에 전파하지 않는다. */
export function reportRendererDiagnostic(code: RendererDiagnosticCode): void {
  try {
    void activeApi?.reportRendererDiagnostic(code).catch(() => {})
  } catch {
    // 종료 중인 preload 연결 실패는 원래 작업 오류와 분리한다.
  }
}

/** 현재 실행의 메인 기록과 화면 오류를 Electron 기본 DevTools Console에 연결한다. */
export function startRendererDiagnostics(api: DiagnosticApi, target: Window = window): () => void {
  let disposed = false
  let lastSequence = 0
  let historyLoaded = false
  const pending: DiagnosticEntry[] = []
  activeApi = api

  function display(entry: DiagnosticEntry): void {
    if (disposed || entry.sequence <= lastSequence) {
      return
    }
    lastSequence = entry.sequence
    const time = new Date(entry.timestamp).toLocaleTimeString()
    const message = DIAGNOSTIC_MESSAGES[entry.code]
    console.warn(`[DFRAGON ${time}] ${entry.code}: ${message}`)
  }

  const unsubscribe = api.onDiagnosticEntry((entry) => {
    if (!historyLoaded) {
      pending.push(entry)
      if (pending.length > DIAGNOSTIC_HISTORY_LIMIT) {
        pending.shift()
      }

      return
    }
    display(entry)
  })
  void api
    .getDiagnosticHistory()
    .then((history) => {
      for (const entry of history) {
        display(entry)
      }
    })
    .catch(() => {})
    .finally(() => {
      historyLoaded = true
      for (const entry of pending) {
        display(entry)
      }
      pending.length = 0
    })

  const onError = (): void => reportRendererDiagnostic('RENDERER_ERROR')
  const onRejection = (): void => reportRendererDiagnostic('RENDERER_REJECTION')
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    if (activeApi === api) {
      activeApi = null
    }
    unsubscribe()
    pending.length = 0
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
    target.removeEventListener('pagehide', dispose)
  }
  target.addEventListener('pagehide', dispose)

  return dispose
}
