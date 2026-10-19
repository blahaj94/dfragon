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
export type CharacterCardPoint = Readonly<{ current: number; min: number; max: number }>
export type CharacterRarityCount = Readonly<{ rarity: string; count: number }>

export type CharacterCardStats =
  | Readonly<{
      role: 'dealer'
      attackIncrease: number | null
      amplification: number | null
      critical: number | null
      switchingLevel: number | null
    }>
  | Readonly<{
      role: 'buffer'
      townIntelligence: number | null
      buff30: number | null
      buff50: number | null
      switchingLevel: number | null
    }>

export type CharacterCardScore = Readonly<{
  calculator: CharacterScoreCalculator
  value: number | null
  skipped: Readonly<{ kind: string; message: string }> | null
  versions: Readonly<{ package: string; rulesRev: string; bundleId: string }>
}>

export type CharacterCardInvestment = Readonly<{
  slotId: string
  slotName: string
  itemId: string | null
  itemName: string | null
  rarity: string | null
  reinforce: Readonly<{
    kind: 'reinforce' | 'amplify'
    value: number
    amplificationName: string | null
  }> | null
  enchant: Readonly<{
    status: readonly Readonly<{ name: string; value: number | string }>[]
    grade: '종결' | '준종결' | '기타' | null
  }> | null
}>

/**
 * API 상세 응답의 카드 투영에 main이 점수 엔진 결과를 채운 값. 모르는 값은 null이며 0이나 빈 값으로
 * 바꾸지 않는다. 형태는 API 응답의 `card`와 같다.
 */
export type CharacterCard = Readonly<{
  role: CharacterCardRole | null
  stats: CharacterCardStats | null
  score: CharacterCardScore | null
  serverRank: Readonly<{
    rank: number
    total: number
    basis: 'fame'
    scope: 'stored'
    observedAt: string
  }> | null
  set: Readonly<{
    setItemId: string
    name: string
    rarityName: string | null
    point: CharacterCardPoint | null
    imageItemId: string | null
    slots: readonly Readonly<{ slotId: string; rarity: string | null }>[]
    rarityCounts: readonly CharacterRarityCount[]
  }> | null
  oath: Readonly<{
    itemId: string
    name: string
    rarity: string | null
    point: number | null
    setName: string | null
    optionName: string | null
    setPoint: CharacterCardPoint | null
    upgrades: readonly Readonly<{ step: number; stepName: string; optionName: string }>[]
    crystals: readonly Readonly<{
      slotNo: number
      itemId: string
      name: string
      rarity: string | null
      setPoint: number | null
    }>[]
    rarityCounts: readonly CharacterRarityCount[]
  }> | null
  investment: readonly CharacterCardInvestment[]
}>

/**
 * 검색 슬롯이 카드에 넘기는 선택 요약. `card`는 main이 검증하지 못하면 null이고 나머지 요약은 그대로
 * 보낸다. `equipmentScore`와 `serverRank`는 `card`의 점수 값과 순위를 그대로 옮긴 값이다.
 */
export type SelectedCharacterSummary = CharacterSummary &
  Readonly<{
    guildName: string | null
    equipmentScore: number | null
    serverRank: number | null
    card: CharacterCard | null
  }>

export type CharacterCandidate = CharacterSearchRow &
  Readonly<{
    serverName: string
    imageUrl: string
    /** API DB에 저장된 모험단명. 저장된 적 없거나 API가 보내지 않으면 null이다. */
    adventureName: string | null
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
