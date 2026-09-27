import type { SchemaObject } from '@nestjs/swagger'

const text: SchemaObject = { type: 'string' }
const timestamp: SchemaObject = { type: 'string', format: 'date-time' }
const opaque: SchemaObject = {
  type: 'string',
  minLength: 43,
  maxLength: 43,
  pattern: '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$',
  description: '32바이트의 canonical base64url (padding 없음)'
}

function object(properties: Record<string, SchemaObject>): SchemaObject {
  return {
    type: 'object',
    required: Object.keys(properties),
    additionalProperties: false,
    properties
  }
}

const user = object({ id: { type: 'string', format: 'uuid' }, nickname: text })
const tokens = {
  tokenType: { type: 'string', enum: ['Bearer'] } satisfies SchemaObject,
  accessToken: text,
  accessTokenExpiresAt: timestamp,
  refreshToken: text,
  sessionExpiresAt: timestamp
}
export const apiSchemas: Record<string, SchemaObject> = {
  ApiError: object({ error: object({ code: text, message: text }) }),
  LoginRequest: object({
    provider: {
      type: 'string',
      enum: ['passkey'],
      description: '패스키만 지원합니다.'
    },
    clientId: { type: 'string', enum: ['desktop', 'ocr'] },
    codeChallenge: opaque,
    codeChallengeMethod: { type: 'string', enum: ['S256'] }
  }),
  CreatedLoginRequest: object({
    requestId: { type: 'string', format: 'uuid' },
    browserUrl: {
      type: 'string',
      format: 'uri',
      description: '시스템 브라우저에서 열 일회용 로그인 URL'
    },
    expiresAt: timestamp
  }),
  LoginExchange: object({
    requestId: { type: 'string', format: 'uuid' },
    clientId: { type: 'string', description: '로그인 요청의 clientId (desktop 또는 설정된 ocr)' },
    code: opaque,
    codeVerifier: opaque
  }),
  LoginTokens: object({ ...tokens, user, isNewUser: { type: 'boolean' } }),
  RefreshRequest: object({ refreshToken: text }),
  RefreshTokens: object(tokens),
  AccountProfile: object({ user }),
  NicknameRequest: object({
    nickname: {
      type: 'string',
      description:
        '앞뒤 공백 제거 후 grapheme 1~20개. 제어문자·줄바꿈·잘못된 UTF-16은 거절합니다. 중복 허용.'
    }
  })
}
