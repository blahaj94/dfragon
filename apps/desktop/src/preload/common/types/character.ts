import type { CharacterSearchRow } from './search'

export type CharacterIdentity = Readonly<{ serverId: string; characterId: string }>

export type CharacterSummary = CharacterIdentity &
  Readonly<{
    characterName: string
    serverName: string
    adventureName: string | null
    jobName: string | null
    jobGrowName: string | null
    level: number | null
    fame: number | null
    imageUrl: string
  }>

export type CharacterCardRole = 'dealer' | 'buffer'
export type CharacterScoreCalculator = 'equipment' | 'buff'

export type CharacterCardScore = Readonly<{
  calculator: CharacterScoreCalculator
  value: number | null
  skipped: Readonly<{ kind: string; message: string }> | null
  approximate: Readonly<{ value: number; source: string; warning: string }> | null
  versions: Readonly<{ package: string; rulesRev: string; bundleId: string }>
}>

export type CharacterCard = Readonly<{
  role: CharacterCardRole | null
  score: CharacterCardScore | null
}>

export type SelectedCharacterSummary = CharacterSummary &
  Readonly<{
    guildName: string | null
    equipmentScore: number | null
    card: CharacterCard | null
  }>

export type CharacterCandidate = CharacterSearchRow &
  Readonly<{
    serverName: string
    imageUrl: string
    adventureName: string | null
    jobName: string | null
    jobGrowName: string | null
  }>

export type CharacterImage = Readonly<{
  width: number
  height: number
  rgba: Uint8Array
}>

export type CharacterPortrait = Readonly<{
  image: CharacterImage
  rasterScale: number
  validMask?: Uint8Array
}>

export type CharacterJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CharacterJsonValue[]
  | { readonly [key: string]: CharacterJsonValue }

export type CharacterSectionMetadata = Readonly<{
  revision: number
  contentUpdatedAt: string
  lastSuccessfulFetchAt: string
}>

export type CharacterDetails = Readonly<{
  character: CharacterIdentity & {
    readonly characterName: string
    readonly serverName: string
    readonly [key: string]: CharacterJsonValue
  }
  status: { readonly status: CharacterJsonValue; readonly buff: CharacterJsonValue }
  equipment: {
    readonly equipment: CharacterJsonValue
    readonly setItemInfo: CharacterJsonValue
  }
  avatar: CharacterJsonValue
  creature: CharacterJsonValue
  oath: CharacterJsonValue
  mistAssimilation: CharacterJsonValue
  skillStyle: CharacterJsonValue
  buff: {
    readonly equipment: CharacterJsonValue
    readonly avatar: CharacterJsonValue
    readonly creature: CharacterJsonValue
  }
  sections: Readonly<Record<string, CharacterSectionMetadata>>
  freshness: Readonly<{ lastSuccessfulFetchAt: string; expiresAt: string }>
  readonly [key: string]: CharacterJsonValue
}>
