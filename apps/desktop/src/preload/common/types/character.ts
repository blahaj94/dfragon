import type { CharacterSearchRow } from './search'

export type CharacterIdentity = Readonly<{ serverId: string; characterId: string }>

export type CharacterCandidate = CharacterSearchRow &
  Readonly<{ serverName: string; imageUrl: string }>

export type CharacterImage = Readonly<{
  width: number
  height: number
  rgba: Uint8Array
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
