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
  const original = text !== null ? JSON.stringify(text) : '없음'
  console.warn(
    `[${PRODUCT_NAME} ${time}] 슬롯 ${slot + 1}의 OCR 첫 후보를 검색에 쓰지 못했습니다. 이유: ${OCR_NICKNAME_REJECTION_REASONS[rejection]}, 원문: ${original}`
  )
}

export function reportRendererDiagnostic(code: RendererDiagnosticCode): void {
  try {
    activeApi?.reportRendererDiagnostic(code).catch(() => {})
  } catch {
    // 종료 중인 preload 연결 실패는 원래 작업 오류와 분리한다.
  }
}

export function startRendererDiagnostics(api: DiagnosticApi): void {
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
  api
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
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  function dispose(): void {
    disposed = true
    if (activeApi === api) {
      activeApi = null
    }
    unsubscribe()
    pending.length = 0
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('pagehide', dispose)
  }
  window.addEventListener('pagehide', dispose)
}
