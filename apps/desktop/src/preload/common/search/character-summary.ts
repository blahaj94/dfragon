import { z } from 'zod'
import type { CharacterIdentity } from '../types/character'

const INVALID_CHARACTER_ID_CHARACTERS_PATTERN = /[^a-zA-Z0-9_-]/
const MAX_CHARACTER_ID_LENGTH = 256
const CHARACTER_IMAGE_ORIGIN = 'https://img-api.neople.co.kr'
const CHARACTER_IMAGE_ZOOM = 1

export const CHARACTER_SERVER_NAMES = {
  anton: '안톤',
  bakal: '바칼',
  cain: '카인',
  casillas: '카시야스',
  diregie: '디레지에',
  hilder: '힐더',
  prey: '프레이',
  siroco: '시로코'
} as const

const nonblank = z.string().refine((value) => value.trim().length > 0)
const serverId = z.enum(
  Object.keys(CHARACTER_SERVER_NAMES) as (keyof typeof CHARACTER_SERVER_NAMES)[]
)
export const characterIdentitySchema = z.object({
  serverId,
  characterId: z
    .string()
    .min(1)
    .max(MAX_CHARACTER_ID_LENGTH)
    .refine((value) => !INVALID_CHARACTER_ID_CHARACTERS_PATTERN.test(value))
})

/** 검증한 캐릭터 식별자에서 고정된 네오플 이미지 URL만 구성한다. */
export function characterImageUrl(identity: CharacterIdentity): string {
  return `${CHARACTER_IMAGE_ORIGIN}/df/servers/${identity.serverId}/characters/${identity.characterId}?zoom=${CHARACTER_IMAGE_ZOOM}`
}

const characterSummaryShape = {
  ...characterIdentitySchema.shape,
  characterName: nonblank,
  serverName: z.string(),
  adventureName: z.string().nullable(),
  jobName: z.string().nullable(),
  jobGrowName: z.string().nullable(),
  level: z.number().nullable(),
  fame: z.number().nullable(),
  imageUrl: z.string()
}

/** 서버 이름과 이미지 URL이 식별자에서 만든 고정 값인지 확인한다. */
function hasFixedServerAndImage(summary: z.infer<z.ZodObject<typeof characterSummaryShape>>) {
  return (
    summary.serverName === CHARACTER_SERVER_NAMES[summary.serverId] &&
    summary.imageUrl === characterImageUrl(summary)
  )
}

export const characterSummarySchema = z
  .strictObject(characterSummaryShape)
  .refine(hasFixedServerAndImage)

const count = z.int().nonnegative()
const point = z.strictObject({ current: z.number(), min: z.number(), max: z.number() })
const rarityCount = z.strictObject({ rarity: nonblank, count })
const dealerStats = z.strictObject({
  role: z.literal('dealer'),
  attackIncrease: z.number().nullable(),
  amplification: z.number().nullable(),
  critical: z.number().nullable(),
  switchingLevel: z.number().nullable()
})
const bufferStats = z.strictObject({
  role: z.literal('buffer'),
  townStatName: z.enum(['지능', '정신력', '체력']),
  townStat: z.number().nullable(),
  buff30: z.number().nullable(),
  buff50: z.number().nullable(),
  switchingLevel: z.number().nullable()
})
const investment = z.strictObject({
  slotId: nonblank,
  slotName: nonblank,
  itemId: nonblank.nullable(),
  itemName: nonblank.nullable(),
  rarity: nonblank.nullable(),
  reinforce: z
    .strictObject({
      kind: z.enum(['reinforce', 'amplify']),
      value: count,
      amplificationName: nonblank.nullable()
    })
    .nullable(),
  enchant: z
    .strictObject({
      status: z.array(z.strictObject({ name: nonblank, value: z.union([z.number(), nonblank]) })),
      grade: z.enum(['종결', '준종결', '기타']).nullable()
    })
    .nullable()
})

/** API의 `card` 투영과 main이 채운 점수를 renderer에 넘기기 전에 검사한다. 숫자는 유한값만 받는다. */
export const characterCardSchema = z.strictObject({
  role: z.enum(['dealer', 'buffer']).nullable(),
  stats: z.discriminatedUnion('role', [dealerStats, bufferStats]).nullable(),
  score: z
    .strictObject({
      calculator: z.enum(['equipment', 'buff']),
      value: z.number().nullable(),
      skipped: z.strictObject({ kind: nonblank, message: nonblank }).nullable(),
      versions: z.strictObject({ package: nonblank, rulesRev: nonblank, bundleId: nonblank })
    })
    .nullable(),
  serverRank: z
    .strictObject({
      rank: z.int().positive(),
      total: z.int().positive(),
      basis: z.literal('fame'),
      scope: z.literal('stored'),
      observedAt: z.iso.datetime({ offset: true })
    })
    .nullable(),
  set: z
    .strictObject({
      setItemId: nonblank,
      name: nonblank,
      rarityName: nonblank.nullable(),
      point: point.nullable(),
      imageItemId: nonblank.nullable(),
      slots: z.array(z.strictObject({ slotId: nonblank, rarity: nonblank.nullable() })),
      rarityCounts: z.array(rarityCount)
    })
    .nullable(),
  oath: z
    .strictObject({
      itemId: nonblank,
      name: nonblank,
      rarity: nonblank.nullable(),
      point: z.number().nullable(),
      setName: nonblank.nullable(),
      optionName: nonblank.nullable(),
      setPoint: point.nullable(),
      upgrades: z.array(
        z.strictObject({ step: z.int().positive(), stepName: nonblank, optionName: nonblank })
      ),
      crystals: z.array(
        z.strictObject({
          slotNo: count,
          itemId: nonblank,
          name: nonblank,
          rarity: nonblank.nullable(),
          setPoint: z.number().nullable()
        })
      ),
      rarityCounts: z.array(rarityCount)
    })
    .nullable(),
  investment: z.array(investment)
})

export const selectedCharacterSummarySchema = z
  .strictObject({
    ...characterSummaryShape,
    guildName: z.string().nullable(),
    equipmentScore: z.number().nullable(),
    serverRank: z.int().positive().nullable(),
    card: characterCardSchema.nullable()
  })
  .refine(hasFixedServerAndImage)
