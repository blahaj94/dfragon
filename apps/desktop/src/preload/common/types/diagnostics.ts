export const DIAGNOSTIC_MESSAGES = {
  CAPTURE_SELECTION_FAILED: '캡처할 창을 준비하지 못했습니다.',
  CAPTURE_START_FAILED: '캡처를 시작하지 못했습니다.',
  CAPTURE_READ_FAILED: '캡처 프레임을 읽지 못했습니다.',
  CAPTURE_COVERED: '선택한 창이 가려져 캡처를 기다립니다.',
  CAPTURE_UNAVAILABLE: '선택한 창에서 캡처할 수 없습니다.',
  CAPTURE_ADMIN_REQUIRED: '게임 창과 앱의 실행 권한을 확인해야 합니다.',
  OCR_FAILED: '닉네임 인식을 완료하지 못했습니다.',
  SEARCH_FAILED: '캐릭터 조회를 완료하지 못했습니다.',
  SEARCH_TIMEOUT: '캐릭터 조회 시간이 초과되었습니다.',
  SEARCH_RESPONSE_INVALID: '캐릭터 조회 응답을 확인하지 못했습니다.',
  SEARCH_UNAVAILABLE: '캐릭터 조회 서비스에 연결하지 못했습니다.',
  SEARCH_APPEARANCE_FALLBACK: '외형을 확인하지 못해 최고 명성 후보를 표시합니다.',
  UPLOAD_FAILED: 'OCR 자료를 업로드하지 못했습니다.',
  UPLOAD_QUEUE_FULL: '업로드 대기 한도를 초과해 자료 수집을 건너뛰었습니다.',
  SHORTCUT_FAILED: '단축키를 준비하지 못했습니다.',
  RENDERER_ERROR: '화면 실행 중 오류가 발생했습니다.',
  RENDERER_REJECTION: '화면의 비동기 작업 중 오류가 발생했습니다.',
  RENDERER_PROCESS_GONE: '화면 프로세스가 종료되었습니다.',
  MAIN_PROCESS_FAILED: '앱의 메인 프로세스에서 오류가 발생했습니다.',
  UPDATE_CHECK_FAILED: '새 버전을 확인하지 못했습니다.',
  UPDATE_RELEASE_OPEN_FAILED: 'Release 페이지를 열지 못했습니다.'
} as const

export type DiagnosticCode = keyof typeof DIAGNOSTIC_MESSAGES

export const RENDERER_DIAGNOSTIC_CODES = [
  'CAPTURE_START_FAILED',
  'CAPTURE_READ_FAILED',
  'OCR_FAILED',
  'SEARCH_FAILED',
  'UPLOAD_FAILED',
  'RENDERER_ERROR',
  'RENDERER_REJECTION'
] as const satisfies readonly DiagnosticCode[]

export type RendererDiagnosticCode = (typeof RENDERER_DIAGNOSTIC_CODES)[number]

export const DIAGNOSTIC_HISTORY_LIMIT = 200
export const DIAGNOSTIC_CHANNELS = {
  history: 'getDiagnosticHistory',
  report: 'reportRendererDiagnostic',
  entry: 'diagnosticEntry'
} as const

export type DiagnosticEntry = Readonly<{
  sequence: number
  timestamp: number
  code: DiagnosticCode
}>

export interface DiagnosticIPCFunctions {
  getDiagnosticHistory: () => Promise<DiagnosticEntry[]>
  reportRendererDiagnostic: (code: RendererDiagnosticCode) => Promise<void>
}

export interface DiagnosticApi extends DiagnosticIPCFunctions {
  onDiagnosticEntry: (listener: (entry: DiagnosticEntry) => void) => () => void
}
