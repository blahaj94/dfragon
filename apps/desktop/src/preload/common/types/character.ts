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

/**
 * 엔진 점수. `value`는 정확한 점수만 담고, 계산을 건너뛴 결과에 엔진이 근사값을 내면 `approximate`에 따로 둔다.
 * `approximate.source`는 엔진이 근사값을 낸 방법이고 `warning`은 엔진의 원문 경고다.
 */
export type CharacterCardScore = Readonly<{
  calculator: CharacterScoreCalculator
  value: number | null
  skipped: Readonly<{ kind: string; message: string }> | null
  approximate: Readonly<{ value: number; source: string; warning: string }> | null
  versions: Readonly<{ package: string; rulesRev: string; bundleId: string }>
}>

/**
 * 카드의 캐릭터 면 값. API 상세 응답의 `card.role`에 main이 점수 엔진 결과를 채운다. 모르는 값은 null이며
 * 0이나 빈 값으로 바꾸지 않는다.
 */
export type CharacterCard = Readonly<{
  role: CharacterCardRole | null
  score: CharacterCardScore | null
}>

/**
 * 검색 슬롯이 카드에 넘기는 선택 요약. `card`는 main이 검증하지 못하면 null이고 나머지 요약은 그대로
 * 보낸다. `equipmentScore`는 `card`의 점수 값을 그대로 옮긴 값이다.
 */
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
    /** API DB에 저장된 모험단명. 저장된 적 없거나 API가 보내지 않으면 null이다. */
    adventureName: string | null
    /** Neople 검색 응답의 직업명과 전직명. 없거나 API가 보내지 않으면 null이다. */
    jobName: string | null
    jobGrowName: string | null
  }>

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
