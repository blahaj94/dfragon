import type { CharacterSearchResult, SearchCharacters } from '../types/neople-character-search.js'

export interface SearchClock {
  now(): number
  setTimer(callback: () => void, delay: number): unknown
  clearTimer(timer: unknown): void
}

export interface CharacterSearchDependencies {
  readonly apiKey: string
  readonly searchCharacters?: SearchCharacters
  readonly clock?: SearchClock
}

export interface CharacterSearchHttpService {
  search(
    peerAddress: string | undefined,
    originalUrl: string,
    signal?: AbortSignal
  ): Promise<CharacterSearchResult>
  onModuleDestroy(): Promise<void>
}
