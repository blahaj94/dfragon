import type {
  CharacterCandidatesResult,
  CharacterSearchResult,
  SearchCharacters
} from '../types/neople-character-search.js'

export interface SearchClock {
  now(): number
  setTimer(callback: () => void, delay: number): unknown
  clearTimer(timer: unknown): void
}

export interface CharacterSearchDependencies {
  readonly trustedProxyHops?: 1
  readonly searchCharacters: SearchCharacters
  /** 후보 응답에 붙일 저장된 모험단명. 없으면 모든 후보의 모험단명이 null이다. */
  readonly findAdventureNames?: (
    characterIds: readonly string[],
    signal: AbortSignal
  ) => Promise<ReadonlyMap<string, string>>
}

export interface CharacterSearchHttpService {
  search(
    peerAddress: string | undefined,
    originalUrl: string,
    signal?: AbortSignal
  ): Promise<CharacterSearchResult>
  candidates(
    peerAddress: string | undefined,
    originalUrl: string,
    signal?: AbortSignal
  ): Promise<CharacterCandidatesResult>
  onModuleDestroy(): Promise<void>
}
