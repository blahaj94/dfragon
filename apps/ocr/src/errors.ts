export const OCR_ERRORS = {
  INVALID_INPUT: { status: 400, message: '입력 값을 확인해 주세요.' },
  LOGIN_INVALID: { status: 400, message: '로그인 요청이 유효하지 않습니다. 다시 로그인해 주세요.' },
  LOGIN_REQUIRED: { status: 401, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' },
  OWNER_REQUIRED: { status: 403, message: '관리자로 등록된 계정만 사용할 수 있습니다.' },
  ORIGIN_REQUIRED: { status: 403, message: '요청한 페이지의 주소를 확인해 주세요.' },
  NOT_FOUND: { status: 404, message: '자료를 찾지 못했습니다.' },
  METHOD_NOT_ALLOWED: { status: 405, message: '지원하지 않는 요청입니다.' },
  CAPTURE_ID_CONFLICT: { status: 409, message: '같은 캡처 ID로 다른 자료가 저장되어 있습니다.' },
  LABEL_SPLIT_CHANGE: { status: 409, message: '정답을 바꾸면 이 이미지의 분할이 변경됩니다.' },
  UPLOAD_TOO_LARGE: { status: 413, message: '이미지 파일이 너무 큽니다.' },
  UPLOAD_BUSY: { status: 429, message: '다른 업로드가 진행 중입니다. 잠시 후 재시도해 주세요.' },
  LOGIN_LIMIT: { status: 429, message: '로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.' },
  UNAVAILABLE: { status: 500, message: '처리하지 못했습니다. 다시 시도해 주세요.' },
  AUTH_UNAVAILABLE: {
    status: 502,
    message: '인증 서버에 연결하지 못했습니다. 다시 시도해 주세요.'
  },
  STORAGE_LIMIT: { status: 507, message: '설정된 저장 용량 한도에 도달했습니다.' }
} as const

export type OcrErrorCode = keyof typeof OCR_ERRORS

export class OcrError extends Error {
  readonly status: number

  constructor(readonly code: OcrErrorCode) {
    super(OCR_ERRORS[code].message)
    this.name = 'OcrError'
    this.status = OCR_ERRORS[code].status
  }
}

export function isOcrErrorCode(value: unknown): value is OcrErrorCode {
  return typeof value === 'string' && Object.hasOwn(OCR_ERRORS, value)
}

export function httpFailure(error: unknown): OcrError {
  if (error instanceof OcrError) {
    return error
  }
  if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.too.large') {
      return new OcrError('UPLOAD_TOO_LARGE')
    }
    if (error.type === 'entity.parse.failed') {
      return new OcrError('INVALID_INPUT')
    }
  }
  // 처리 과정의 버그를 사용자 입력 오류로 바꾸거나 원문을 응답에 노출하지 않는다.
  return new OcrError('UNAVAILABLE')
}
