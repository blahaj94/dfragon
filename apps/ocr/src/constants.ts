export const OCR_AUTH = {
  sessionCookie: '__Host-ocr-session',
  pendingCookie: '__Host-ocr-login',
  cookieOptions: { path: '/', secure: true, httpOnly: true, sameSite: 'lax' },
  opaqueBytes: 32,
  maximumPendingLogins: 100,
  maximumSessions: 20,
  pendingLifetimeMs: 10 * 60_000,
  sessionLifetimeMs: 8 * 60 * 60_000,
  refreshMarginMs: 30_000,
  requestTimeoutMs: 10_000,
  clientId: 'ocr'
} as const

export const OCR_UPLOAD = {
  maximumPngBytes: 16 * 1024 * 1024,
  maximumDimension: 8192,
  maximumPixels: 16_777_216,
  maximumCrops: 4,
  maximumUiScale: 10,
  maximumConcurrent: 2,
  bodyLimit: '23mb',
  ordinaryBodyLimit: '16kb'
} as const

export const OCR_SAMPLES = { pageSize: 100, maximumLabelLength: 100 } as const
