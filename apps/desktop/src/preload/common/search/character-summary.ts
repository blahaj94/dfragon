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

function hasFixedServerAndImage(summary: z.infer<z.ZodObject<typeof characterSummaryShape>>) {
  return (
    summary.serverName === CHARACTER_SERVER_NAMES[summary.serverId] &&
    summary.imageUrl === characterImageUrl(summary)
  )
}

const characterRole = z.enum(['dealer', 'buffer']).nullable()

export const apiCharacterCardSchema = z.object({ role: characterRole })

const characterCardSchema = z.strictObject({
  role: characterRole,
  score: z
    .strictObject({
      calculator: z.enum(['equipment', 'buff']),
      value: z.number().nullable(),
      skipped: z.strictObject({ kind: nonblank, message: nonblank }).nullable(),
      approximate: z
        .strictObject({ value: z.number(), source: nonblank, warning: nonblank })
        .nullable(),
      versions: z.strictObject({ package: nonblank, rulesRev: nonblank, bundleId: nonblank })
    })
    .refine(
      (score) => score.approximate === null || (score.value === null && score.skipped !== null)
    )
    .nullable()
})

export const selectedCharacterSummarySchema = z
  .strictObject({
    ...characterSummaryShape,
    guildName: z.string().nullable(),
    equipmentScore: z.number().nullable(),
    card: characterCardSchema.nullable()
  })
  .refine(hasFixedServerAndImage)
