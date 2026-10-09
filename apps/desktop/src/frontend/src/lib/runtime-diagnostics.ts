import { PRODUCT_NAME } from '@dfragon/lib'
import {
  DIAGNOSTIC_MESSAGES,
  DIAGNOSTIC_HISTORY_LIMIT,
  type DiagnosticApi,
  type DiagnosticEntry,
  type RendererDiagnosticCode
} from '../../../preload/common/types/diagnostics'

let activeApi: DiagnosticApi | null = null

const OCR_NICKNAME_REJECTION_REASONS = {
  missing: '후보 없음',
  empty: '빈 문자열',
  'too-long': '최대 길이 초과',
  malformed: '잘못된 Unicode'
} as const

export type OcrNicknameRejection = keyof typeof OCR_NICKNAME_REJECTION_REASONS

/** 검색에 쓰지 못한 OCR 첫 후보의 원문을 메인 진단 기록과 분리해 이 화면의 Console에만 표시한다. */
export function showRejectedOcrNickname({
  slot,
  text,
  rejection
}: {
  slot: number
  text: string | null
  rejection: OcrNicknameRejection
}): void {
  const time = new Date().toLocaleTimeString()
  // 앞뒤 공백과 잘못된 Unicode가 보이도록 JSON 문자열로 표시한다.
  const original = text === null ? '없음' : JSON.stringify(text)
  console.warn(
    `[${PRODUCT_NAME} ${time}] 슬롯 ${slot + 1}의 OCR 첫 후보를 검색에 쓰지 못했습니다. 이유: ${OCR_NICKNAME_REJECTION_REASONS[rejection]}, 원문: ${original}`
  )
}

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
    console.warn(`[${PRODUCT_NAME} ${time}] ${entry.code}: ${message}`)
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
