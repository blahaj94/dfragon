import type { CharacterIdentity } from './character'

export type CharacterAppearanceAvatar = Readonly<{
  slotId: string
  itemId: string
  itemName: string
  clone: Readonly<{ itemId: string | null; itemName: string | null }>
}>

export type CharacterAppearance = CharacterIdentity &
  Readonly<{
    characterName: string
    jobName: string
    jobGrowName: string
    avatar: readonly CharacterAppearanceAvatar[]
  }>
