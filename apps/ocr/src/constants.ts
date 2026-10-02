import { OCR_DATA_LIMITS } from '@dfragon/lib/ocr-contract'

export const OCR_AUTH = {
  sessionCookie: '__Host-ocr-session',
  pendingCookie: '__Host-ocr-login',
  cookieOptions: { path: '/', secure: true, httpOnly: true, sameSite: 'lax' },
  opaqueBytes: 32,
  maximumPendingLogins: 100,
  maximumPendingLoginsPerClient: 3,
  maximumLoginAttemptsPerClient: 10,
  maximumLoginAttempts: 60,
  loginWindowMs: 60_000,
  maximumSessions: 20,
  pendingLifetimeMs: 10 * 60_000,
  sessionLifetimeMs: 8 * 60 * 60_000,
  refreshMarginMs: 30_000,
  requestTimeoutMs: 10_000,
  clientId: 'ocr'
} as const

export const OCR_UPLOAD = {
  maximumPngBytes: OCR_DATA_LIMITS.maximumPngBytes,
  maximumDimension: OCR_DATA_LIMITS.maximumDimension,
  maximumPixels: OCR_DATA_LIMITS.maximumPixels,
  maximumCropsByKind: OCR_DATA_LIMITS.maximumCropsByKind,
  maximumUiScale: OCR_DATA_LIMITS.maximumUiScale,
  maximumConcurrent: 2,
  bodyLimit: '23mb',
  ordinaryBodyLimit: '16kb'
} as const

export const OCR_SAMPLES = {
  pageSize: 100,
  maximumLabelLength: OCR_DATA_LIMITS.maximumLabelLength
} as const
