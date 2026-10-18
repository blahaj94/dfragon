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

export const selectedCharacterSummarySchema = z
  .strictObject({
    ...characterSummaryShape,
    guildName: z.string().nullable(),
    equipmentScore: z.number().nullable(),
    serverRank: z.int().positive().nullable()
  })
  .refine(hasFixedServerAndImage)
