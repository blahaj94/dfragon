export interface NeopleCharacterSearchInput {
  characterName: string
  serverId: string
  limit: number
  wordType?: 'full' | 'match'
}

export interface CharacterCandidate {
  characterId: string
  characterName: string
  serverId: string
  serverName: string | null
  fame: number | null
}

/** Neople 검색 응답의 행. 직업명은 후보 API만 노출하고 `/characters`는 CharacterCandidate로 줄여 반환한다. */
export interface CharacterSearchRow extends CharacterCandidate {
  jobName: string | null
  jobGrowName: string | null
}

export interface CharacterSearchResult {
  rows: CharacterCandidate[]
}

export interface NeopleCharacterSearchResult {
  rows: CharacterSearchRow[]
}

export interface CharacterImageCandidate extends CharacterSearchRow {
  imageUrl: string
  /** 우리 DB에 저장된 모험단명. 저장된 적 없거나 조회하지 못하면 null이다. */
  adventureName: string | null
}

export interface CharacterCandidatesResult {
  rows: CharacterImageCandidate[]
}

export interface SearchErrorBody {
  error: {
    code: string
    message: string
  }
}

export type FetchTransport = (request: string | URL, init?: RequestInit) => Promise<Response>
export type SearchCharacters = (
  input: NeopleCharacterSearchInput
) => Promise<NeopleCharacterSearchResult>

export interface SearchDependencies {
  fetch: FetchTransport
  origin: string
  now: () => number
  setTimer: (callback: () => void, delay: number) => unknown
  clearTimer: (timer: unknown) => void
}

export interface NeopleCharacterSearchTestDependencies {
  fetch: FetchTransport
  origin?: string
  now?: () => number
  setTimer?: SearchDependencies['setTimer']
  clearTimer?: SearchDependencies['clearTimer']
}
