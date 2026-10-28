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
