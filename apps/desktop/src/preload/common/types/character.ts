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

export type CharacterCandidate = CharacterSearchRow &
  Readonly<{ serverName: string; imageUrl: string }>

export type CharacterImage = Readonly<{
  width: number
  height: number
  rgba: Uint8Array
}>

/** 크롭을 마친 원본 얼굴과 게임 UI의 래스터 배율. 화면 좌표는 크롭 구현이 소유한다. */
export type CharacterPortrait = Readonly<{
  image: CharacterImage
  rasterScale: number
  /** 픽셀당 0 또는 1. 왕관 등 비교에서 제외할 영역은 0이며 생략하면 모두 사용한다. */
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
