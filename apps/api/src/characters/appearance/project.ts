import type { CharacterIdentity } from '../identity.js'
import { CharacterDetailFailure } from '../details/errors.js'

export interface AppearanceAvatar {
  slotId: string
  itemId: string
  itemName: string
  clone: { itemId: string | null; itemName: string | null }
}

export interface CharacterAppearance extends CharacterIdentity {
  characterName: string
  jobName: string
  jobGrowName: string
  avatar: AppearanceAvatar[]
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function projectClone(value: unknown): AppearanceAvatar['clone'] {
  if (value == null) {
    return { itemId: null, itemName: null }
  }

  if (!object(value)) {
    throw new CharacterDetailFailure('api')
  }
  const { itemId, itemName } = value
  if (itemId === null && itemName === null) {
    return { itemId, itemName }
  }

  if (!nonblank(itemId) || !nonblank(itemName)) {
    throw new CharacterDetailFailure('api')
  }

  return { itemId, itemName }
}

/** 아바타 외형 식별 필드만 투영하고 공급자 슬롯 순서와 원문을 보존한다. */
export function projectCharacterAppearance(
  identity: CharacterIdentity,
  body: unknown
): CharacterAppearance {
  if (
    !object(body) ||
    body.serverId !== identity.serverId ||
    body.characterId !== identity.characterId ||
    !nonblank(body.characterName) ||
    !nonblank(body.jobName) ||
    !nonblank(body.jobGrowName) ||
    (body.avatar !== null && !Array.isArray(body.avatar))
  ) {
    throw new CharacterDetailFailure('api')
  }
  const avatar: AppearanceAvatar[] = []
  const slots = new Set<string>()
  if (body.avatar !== null) {
    for (const entry of body.avatar) {
      if (
        !object(entry) ||
        !nonblank(entry.slotId) ||
        !nonblank(entry.itemId) ||
        !nonblank(entry.itemName) ||
        slots.has(entry.slotId)
      ) {
        throw new CharacterDetailFailure('api')
      }
      slots.add(entry.slotId)
      const clone = projectClone(entry.clone)
      avatar.push({ slotId: entry.slotId, itemId: entry.itemId, itemName: entry.itemName, clone })
    }
  }

  return {
    serverId: identity.serverId,
    characterId: identity.characterId,
    characterName: body.characterName,
    jobName: body.jobName,
    jobGrowName: body.jobGrowName,
    avatar
  }
}
