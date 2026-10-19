import type { CharacterDetails, CharacterSummary } from './character'

export type CharacterSelectionReference = Readonly<{
  captureId: string
  slot: number
  requestId: string
}>

export type CharacterDetailSnapshot = Readonly<{
  character: CharacterSummary
  freshness: CharacterDetails['freshness']
}>

export type OpenCharacterDetailResult = Readonly<{ ok: boolean }>

export type CharacterDetailApi = Readonly<{
  read: () => Promise<CharacterDetailSnapshot>
}>

declare global {
  interface Window {
    characterDetail: CharacterDetailApi
  }
}
