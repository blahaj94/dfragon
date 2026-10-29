import type { SchemaObject } from '@nestjs/swagger'
import { CHARACTER_ID_PATTERN_SOURCE } from '../characters/identity.js'
import { characterDetailSections } from '../characters/details/sections.js'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'

const text: SchemaObject = { type: 'string' }
const timestamp: SchemaObject = { type: 'string', format: 'date-time' }
function object(properties: Record<string, SchemaObject>): SchemaObject {
  const required = Object.keys(properties)

  return {
    type: 'object',
    required,
    additionalProperties: false,
    properties
  }
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

const catalogDetail = object({
  data: {
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Neople 공용 상세 원본. 캐릭터 장착 상태와 별개입니다.'
  },
  fetchedAt: { ...timestamp, nullable: true },
  status: {
    type: 'string',
    enum: ['fresh', 'unavailable'],
    description: '이번 요청에서 조회함 / 조회 실패, 예산 종료'
  }
})
const catalogEquipment: SchemaObject = {
  description:
    '원본 장착 배열의 각 장비에 itemDetail을 추가합니다. 슬롯 수와 시즌별 옵션은 보존합니다.',
  oneOf: [
    {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: { itemDetail: catalogDetail },
        required: ['itemDetail']
      }
    },
    { type: 'object', additionalProperties: true, nullable: true }
  ]
}

const catalogItem: SchemaObject = {
  type: 'object',
  nullable: true,
  additionalProperties: true,
  description: '유효한 itemId가 있는 항목에 itemDetail을 추가합니다. 빈 슬롯은 그대로 보존합니다.',
  properties: { itemDetail: catalogDetail }
}
const catalogAvatar: SchemaObject = {
  ...catalogItem,
  properties: {
    itemDetail: catalogDetail,
    clone: { ...catalogItem, description: '외형 참조. 장착 옵션과 합산하지 않습니다.' },
    emblems: { type: 'array', nullable: true, items: catalogItem }
  }
}
const catalogAvatars: SchemaObject = { type: 'array', nullable: true, items: catalogAvatar }
const catalogCreature: SchemaObject = {
  ...catalogItem,
  properties: {
    itemDetail: catalogDetail,
    clone: { ...catalogItem, description: '외형 참조. 장착 옵션과 합산하지 않습니다.' },
    artifact: { type: 'array', nullable: true, items: catalogItem }
  }
}

const retiredNull = (description: string): SchemaObject => ({
  nullable: true,
  enum: [null],
  description: `항상 null. ${description} 이전 Desktop과의 호환을 위해 필드만 남깁니다.`
})
const characterCard = object({
  role: {
    type: 'string',
    enum: ['dealer', 'buffer'],
    nullable: true,
    description:
      'jobGrowName이 크루세이더, 인챈트리스, 패러메딕, 뮤즈(眞 접두 포함)면 buffer, 그 밖은 dealer, 직업을 모르면 null.'
  },
  stats: retiredNull('카드 스탯 한 줄의 값이었습니다.'),
  score: retiredNull('장비 점수는 Desktop 점수 엔진이 채웁니다.'),
  serverRank: retiredNull('저장한 캐릭터끼리 비교하던 명성 순위였습니다.'),
  set: retiredNull('카드 장비 면의 세트 값이었습니다.'),
  oath: retiredNull('카드 장비 면의 서약 값이었습니다.'),
  investment: {
    type: 'array',
    maxItems: 0,
    items: object({}),
    description:
      '항상 빈 배열. 카드 기타 면의 12부위 값이었으며 이전 Desktop과의 호환을 위해 필드만 남깁니다.'
  }
})

export const apiSchemas: Record<string, SchemaObject> = {
  CatalogDetail: catalogDetail,
  ApiError: object({ error: object({ code: text, message: text }) }),
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
  CharacterCandidatesResult: object({
    rows: {
      type: 'array',
      description: 'fame 내림차순, null은 마지막. 동률과 null은 공급자 순서 유지.',
      items: object({
        characterId: {
          type: 'string',
          pattern: CHARACTER_ID_PATTERN_SOURCE,
          minLength: 1,
          maxLength: 256
        },
        characterName: text,
        serverId: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] },
        serverName: text,
        fame: { type: 'number', nullable: true },
        jobName: {
          type: 'string',
          nullable: true,
          description:
            'Neople 검색 응답의 jobName. 문자열이 아니거나 비어 있으면 null이며 상세를 조회하지 않습니다.'
        },
        jobGrowName: {
          type: 'string',
          nullable: true,
          description:
            'Neople 검색 응답의 jobGrowName. 문자열이 아니거나 비어 있으면 null이며 상세를 조회하지 않습니다.'
        },
        imageUrl: {
          type: 'string',
          format: 'uri',
          description: 'Neople 전체 캐릭터 이미지 URL. Desktop에서 파티원 얼굴 영역과 비교합니다.',
          example: 'https://img-api.neople.co.kr/df/servers/cain/characters/character-id?zoom=1'
        },
        adventureName: {
          type: 'string',
          nullable: true,
          description:
            '항상 null. 저장한 상세에서 찾던 값이며 기존 Desktop과의 호환을 위해 필드만 남깁니다.'
        }
      })
    }
  }),
  CharacterDetails: object({
    freshness: object({
      lastSuccessfulFetchAt: {
        ...timestamp,
        description: '11개 캐릭터 섹션을 조회한 시각.'
      },
      expiresAt: {
        ...timestamp,
        description: 'Neople에서 받은 시각 + 1시간. 서버 캐시가 이 시각까지 같은 값을 돌려줍니다.'
      }
    }),
    character: object({
      characterId: text,
      serverId: text,
      serverName: { type: 'string', nullable: true },
      characterName: text,
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
    equipment: object({ equipment: catalogEquipment, setItemInfo: providerValue }),
    avatar: catalogAvatars,
    creature: catalogCreature,
    oath: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      properties: {
        info: catalogItem,
        crystal: { type: 'array', nullable: true, items: catalogItem },
        setInfo: {
          ...providerValue,
          description: '현재 적용된 서약 세트 원본.'
        }
      }
    },
    mistAssimilation: providerValue,
    skillStyle: providerValue,
    buff: object({
      equipment: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        description: 'Neople skill.buff 값. 장비마다 itemDetail을 추가합니다.',
        properties: { equipment: catalogEquipment }
      },
      avatar: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        properties: { avatar: catalogAvatars }
      },
      creature: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        properties: { creature: { type: 'array', nullable: true, items: catalogCreature } }
      }
    }),
    sections: object(
      Object.fromEntries(characterDetailSections.map((name) => [name, sectionMetadata]))
    ),
    card: {
      ...characterCard,
      description: '카드의 역할. 직업을 모르면 null이며 점수는 Desktop이 채웁니다.'
    }
  })
}
