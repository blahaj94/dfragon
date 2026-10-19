import type { SchemaObject } from '@nestjs/swagger'
import { characterDetailSections } from '../characters/details/sections.js'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'

const CHARACTER_CANDIDATE_ID_SCHEMA_PATTERN = '^[a-zA-Z0-9_-]{1,256}$'

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
    description: 'DB에 저장된 공용 상세 원본. 캐릭터 장착 상태와 별개입니다.'
  },
  fetchedAt: { ...timestamp, nullable: true },
  status: {
    type: 'string',
    enum: ['fresh', 'stale', 'unavailable'],
    description: '유효한 캐시 / 갱신 실패, 예산 종료로 이전 캐시 사용 / 전달할 캐시 없음'
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

const nullableNumber: SchemaObject = { type: 'number', nullable: true }
const nullableText: SchemaObject = { type: 'string', nullable: true }
function nullable(schema: SchemaObject): SchemaObject {
  return { ...schema, nullable: true }
}
const cardSetPoint = nullable(
  object({ current: { type: 'number' }, min: { type: 'number' }, max: { type: 'number' } })
)
const cardRarityCounts: SchemaObject = {
  type: 'array',
  description: '희귀도별 개수. 처음 나온 희귀도 순서이며 희귀도가 없는 항목은 세지 않습니다.',
  items: object({ rarity: text, count: { type: 'integer', minimum: 1 } })
}
const characterCard = object({
  role: {
    type: 'string',
    enum: ['dealer', 'buffer'],
    nullable: true,
    description:
      'jobGrowName이 크루세이더, 인챈트리스, 패러메딕, 뮤즈(眞 접두 포함)면 buffer, 그 밖은 dealer, 직업을 모르면 null.'
  },
  stats: {
    description:
      'Neople status의 마을 능력치. switchingLevel, buff30, buff50은 Desktop 점수 엔진이 채우며 API에서는 항상 null입니다.',
    oneOf: [
      nullable(
        object({
          role: { type: 'string', enum: ['dealer'] },
          attackIncrease: nullableNumber,
          amplification: nullableNumber,
          critical: { ...nullableNumber, description: '물리, 마법 크리티컬 중 큰 값' },
          switchingLevel: nullableNumber
        })
      ),
      object({
        role: { type: 'string', enum: ['buffer'] },
        townIntelligence: nullableNumber,
        buff30: nullableNumber,
        buff50: nullableNumber,
        switchingLevel: nullableNumber
      })
    ]
  },
  score: nullable(
    object({
      calculator: { type: 'string', enum: ['equipment', 'buff'] },
      value: nullableNumber,
      skipped: nullable(object({ kind: text, message: text })),
      versions: object({ package: text, rulesRev: text, bundleId: text })
    })
  ),
  serverRank: {
    ...object({
      rank: { type: 'integer', minimum: 1 },
      total: { type: 'integer', minimum: 1 },
      basis: { type: 'string', enum: ['fame'] },
      scope: { type: 'string', enum: ['stored'] },
      observedAt: timestamp
    }),
    nullable: true,
    description:
      '우리 DB에 수집된 모든 서버 캐릭터의 명성 순위. 통합 서버라 서버를 나누지 않습니다. 명성이 더 큰 캐릭터 수 + 1이며 동점은 같은 순위입니다. 명성이 없거나 순위 조회가 실패하면 null입니다.'
  },
  set: nullable(
    object({
      setItemId: text,
      name: text,
      rarityName: nullableText,
      point: cardSetPoint,
      imageItemId: { ...nullableText, description: '세트에 속한 장착 아이템 중 첫 번째' },
      slots: { type: 'array', items: object({ slotId: text, rarity: nullableText }) },
      rarityCounts: cardRarityCounts
    })
  ),
  oath: nullable(
    object({
      itemId: text,
      name: text,
      rarity: nullableText,
      point: nullableNumber,
      setName: nullableText,
      optionName: nullableText,
      setPoint: cardSetPoint,
      upgrades: {
        type: 'array',
        description: '묵언의 진의 단계. 업그레이드가 없으면 빈 배열입니다.',
        items: object({ step: { type: 'integer', minimum: 1 }, stepName: text, optionName: text })
      },
      crystals: {
        type: 'array',
        items: object({
          slotNo: { type: 'number' },
          itemId: text,
          name: text,
          rarity: nullableText,
          setPoint: nullableNumber
        })
      },
      rarityCounts: cardRarityCounts
    })
  ),
  investment: {
    type: 'array',
    minItems: 12,
    maxItems: 12,
    description:
      '무기, 상의, 머리어깨, 하의, 벨트, 신발, 목걸이, 팔찌, 반지, 보조장비, 마법석, 귀걸이 순서의 12부위. 빈 슬롯은 아이템 필드가 null입니다.',
    items: object({
      slotId: text,
      slotName: text,
      itemId: nullableText,
      itemName: nullableText,
      rarity: nullableText,
      reinforce: nullable(
        object({
          kind: { type: 'string', enum: ['reinforce', 'amplify'] },
          value: { type: 'number' },
          amplificationName: nullableText
        })
      ),
      enchant: nullable(
        object({
          status: {
            type: 'array',
            items: object({
              name: text,
              value: { oneOf: [{ type: 'number' }, { type: 'string' }] }
            })
          },
          grade: {
            type: 'string',
            enum: ['종결', '준종결', '기타'],
            nullable: true,
            description:
              '마법부여 등급표와 모든 옵션 이름, 값이 같을 때만 정하며 표에 없으면 null(미평가)입니다.'
          }
        })
      )
    })
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
          pattern: CHARACTER_CANDIDATE_ID_SCHEMA_PATTERN,
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
            '우리 DB에 저장된 모험단명. 상세 조회로 저장된 적 없거나 조회하지 못하면 null이며 Neople을 호출하지 않습니다.'
        }
      })
    }
  }),
  AdventureCharacters: object({
    adventureName: text,
    scope: {
      type: 'string',
      enum: ['stored'],
      description: '우리 DB에서 관측된 캐릭터만 포함하며 전체 보유 목록을 보장하지 않습니다.'
    },
    rows: {
      type: 'array',
      items: object({
        characterId: text,
        serverId: text,
        serverName: { type: 'string', nullable: true },
        characterName: { type: 'string', nullable: true },
        level: { type: 'number', nullable: true },
        jobName: { type: 'string', nullable: true },
        jobGrowName: { type: 'string', nullable: true },
        fame: { type: 'number', nullable: true },
        lastSuccessfulFetchAt: timestamp
      })
    },
    nextAfter: { type: 'string', nullable: true }
  }),
  CharacterDetails: object({
    freshness: object({
      lastSuccessfulFetchAt: {
        ...timestamp,
        description:
          '11개 캐릭터 섹션 중 가장 오래된 성공 조회 시각. 캐시 적중 시 갱신되지 않습니다.'
      },
      expiresAt: {
        ...timestamp,
        description: '마지막 성공 조회 시각 + 5분. 공용 상세의 24시간 캐시와 별개입니다.'
      }
    }),
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
          description: '현재 적용된 서약 세트 원본. 숫자 setId는 setDetails의 키가 아닙니다.'
        }
      }
    },
    setDetails: {
      type: 'object',
      additionalProperties: catalogDetail,
      description:
        '장착 응답과 공용 아이템 상세가 직접 참조하는 setItemId별 세트 상세. 외형 참조의 세트도 포함할 수 있으며 적용 여부를 뜻하지 않습니다. 세트 구성품을 재귀 조회하지 않습니다.'
    },
    mistAssimilation: providerValue,
    skillStyle: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      properties: {
        skillDetails: {
          type: 'object',
          additionalProperties: catalogDetail,
          description:
            '캐릭터 직업의 skillId별 공용 상세. 습득, 진화, 강화, 체인, 버프 스킬 참조를 포함합니다.'
        }
      }
    },
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
      description:
        '저장된 섹션을 카드 세 면(캐릭터, 장비, 기타)용으로 정규화한 값. 모르는 값은 null이며 점수는 Desktop이 채웁니다.'
    }
  })
}
