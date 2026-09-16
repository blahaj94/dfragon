import type { SchemaObject } from '@nestjs/swagger'
import { characterDetailSections } from '../characters/details/sections.js'

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
const providerValue: SchemaObject = {
  description: 'Neople 섹션 값. 미장착은 null이며 시즌별 중첩 필드와 배열을 그대로 보존합니다.',
  oneOf: [
    { type: 'object', additionalProperties: true, nullable: true },
    { type: 'array', items: {} }
  ]
}
const sectionMetadata = object({
  revision: { type: 'integer', minimum: 1 },
  contentUpdatedAt: timestamp,
  lastSuccessfulFetchAt: timestamp
})

export const apiSchemas: Record<string, SchemaObject> = {
  ApiError: object({ error: object({ code: text, message: text }) }),
  LoginRequest: object({
    provider: {
      type: 'string',
      enum: ['google', 'discord'],
      description: '기본 runtime은 Google만 등록합니다. Discord는 현재 사용할 수 없습니다.'
    },
    clientId: { type: 'string', enum: ['desktop'] },
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
    clientId: { type: 'string', description: '로그인 요청의 clientId (desktop)' },
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
  }),
  CharacterSearchResult: object({
    rows: {
      type: 'array',
      items: object({
        characterId: text,
        characterName: text,
        serverId: text,
        serverName: { type: 'string', nullable: true },
        fame: { type: 'number', nullable: true }
      })
    }
  }),
  CharacterDetails: object({
    character: object({
      characterId: text,
      serverId: text,
      serverName: { type: 'string', nullable: true },
      characterName: text,
      // 기본정보의 부가 필드는 현재 adapter가 타입을 제한하지 않습니다.
      ...Object.fromEntries(
        [
          'level',
          'jobId',
          'jobGrowId',
          'jobName',
          'jobGrowName',
          'fame',
          'adventureName',
          'guildId',
          'guildName'
        ].map((name) => [name, { description: 'Neople 기본정보 값. 누락 시 null.' }])
      )
    }),
    status: object({ status: providerValue, buff: providerValue }),
    equipment: object({ equipment: providerValue, setItemInfo: providerValue }),
    avatar: providerValue,
    creature: providerValue,
    oath: providerValue,
    mistAssimilation: providerValue,
    skillStyle: providerValue,
    buff: object({
      equipment: { description: 'Neople skill.buff 값 또는 null' },
      avatar: { description: 'Neople skill.buff 값 또는 null' },
      creature: { description: 'Neople skill.buff 값 또는 null' }
    }),
    sections: object(
      Object.fromEntries(characterDetailSections.map((name) => [name, sectionMetadata]))
    )
  })
}
