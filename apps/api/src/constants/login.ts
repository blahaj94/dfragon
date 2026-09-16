import { AUTH_ERRORS } from './auth.js'

const invalidMessage = '로그인 요청이 유효하지 않습니다. 다시 로그인해 주세요.'

type LoginErrorDefinitionShape = Readonly<{
  code: string
  status: number
  message: string
}>

export const LOGIN_ERRORS = {
  ...AUTH_ERRORS,
  INVALID_REQUEST: {
    code: 'INVALID_AUTH_REQUEST',
    status: 400,
    message: '인증 요청을 확인해 주세요.'
  },
  REQUEST_INVALID: {
    code: 'LOGIN_REQUEST_INVALID',
    status: 400,
    message: invalidMessage
  },
  EXCHANGE_INVALID: {
    code: 'LOGIN_EXCHANGE_INVALID',
    status: 400,
    message: invalidMessage
  },
  CANCELLED: {
    code: 'LOGIN_CANCELLED',
    status: 400,
    message: '로그인이 취소됐습니다.'
  },
  PASSKEY: {
    code: 'PASSKEY_INVALID',
    status: 400,
    message: '패스키를 확인하지 못했습니다. 다시 시도해 주세요.'
  },
  LAST_PASSKEY: {
    code: 'LAST_PASSKEY',
    status: 400,
    message: '마지막 패스키는 삭제할 수 없습니다. 다른 패스키를 먼저 추가해 주세요.'
  },
  PASSKEY_LIMIT: {
    code: 'PASSKEY_LIMIT',
    status: 400,
    message: '패스키는 계정당 최대 20개까지 등록할 수 있습니다.'
  },
  RATE_LIMIT: {
    code: 'AUTH_RATE_LIMIT',
    status: 429,
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  },
  TOO_LARGE: {
    code: 'REQUEST_TOO_LARGE',
    status: 413,
    message: '요청 크기를 줄여 주세요.'
  },
  MEDIA: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    status: 415,
    message: 'JSON 형식으로 요청해 주세요.'
  }
} as const satisfies Record<string, LoginErrorDefinitionShape>

export const LOGIN = {
  clientId: 'desktop',
  purpose: 'login',
  method: 'S256',
  requestSeconds: 600,
  codeSeconds: 60,
  idleSeconds: 2_592_000,
  jsonBytes: 16_384,
  phoneCookiePrefix: '__Host-ldb-phone-',
  cookiePrefix: '__Host-ldb-login-',
  contentSecurityPolicy:
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
} as const

export const CLEARED_LOGIN_FIELDS = {
  codeChallenge: null,
  launchTicketHash: null,
  browserBindingHash: null,
  qrTicketHash: null,
  phoneBindingHash: null,
  confirmationCode: null,
  webauthnChallenge: null,
  operation: null,
  pendingUserId: null,
  verifiedUserId: null,
  credentialId: null,
  exchangeCodeHash: null,
  codeExpiresAt: null
} as const
