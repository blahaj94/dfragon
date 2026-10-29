import type { CharacterPortrait, SelectedCharacterSummary } from './character'

export const SEARCH_SLOT_COUNTS = { party: 4, raid: 12 } as const
export type SearchSlotCount = (typeof SEARCH_SLOT_COUNTS)[keyof typeof SEARCH_SLOT_COUNTS]

export const SEARCH_ACTIONS = {
  READ: 'read',
  BEGIN: 'begin',
  END: 'end',
  RETRY: 'retry',
  LOOKUP: 'lookup'
} as const

export const CHARACTER_SELECTION_METHODS = [
  'portrait',
  'job',
  'fame',
  'highest-fame',
  'manual'
] as const
export type CharacterSelectionMethod = (typeof CHARACTER_SELECTION_METHODS)[number]

export const SELECTED_DETAILS_STATES = ['pending', 'failed'] as const
export type SelectedDetailsState = (typeof SELECTED_DETAILS_STATES)[number]

export type ManualCharacterLookup = SearchObservation & Readonly<{ serverId: string }>

export type SearchControl =
  | Readonly<{ action: typeof SEARCH_ACTIONS.READ }>
  | Readonly<{ action: typeof SEARCH_ACTIONS.BEGIN }>
  | (Readonly<{ action: typeof SEARCH_ACTIONS.LOOKUP }> & ManualCharacterLookup)
  | Readonly<{ action: typeof SEARCH_ACTIONS.END; captureId: string }>
  | Readonly<{
      action: typeof SEARCH_ACTIONS.RETRY
      captureId: string
      slot: number
      requestId: string
    }>

export type SearchObservation = Readonly<{
  captureId: string
  slot: number
  observationRevision: number
  nickname: string
}>

export const RAID_VALUE_COLUMNS = ['fame', 'equipment-score', 'unknown'] as const
export type RaidValueColumn = (typeof RAID_VALUE_COLUMNS)[number]

/** 직업명 칸에는 이보다 긴 글자가 들어가지 않는다. */
export const MAX_RAID_JOB_TEXT_LENGTH = 32
export const RAID_VALUE_TEXT_PATTERN = /^[0-9,.K]{1,16}$/

export type RaidRowObservation = Readonly<{
  jobText: string | null
  valueColumn: RaidValueColumn
  valueText: string | null
}>

export type OcrSearchInput = Readonly<{
  candidateNicknames: readonly string[]
  portrait: CharacterPortrait | null
  raidRow?: RaidRowObservation
}>
export type OcrSearchObservation = SearchObservation & OcrSearchInput

export type CharacterSearchRow = Readonly<{
  characterId: string
  characterName: string
  serverId: string
  serverName: string | null
  fame: number | null
}>

export type CharacterFaceWindow = Readonly<{ x: number; y: number; width: number; height: number }>

export type CharacterChoice = CharacterSearchRow &
  Readonly<{ adventureName: string | null; face: CharacterFaceWindow | null }>

type SearchErrorDefinition = Readonly<{ message: string; retryable: boolean }>

export const SEARCH_ERRORS = {
  INVALID_SEARCH_QUERY: { message: '검색 조건을 확인해 주세요.', retryable: false },
  SEARCH_RATE_LIMITED: {
    message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true
  },
  INTERNAL_SERVER_ERROR: { message: '서버 오류로 검색을 처리하지 못했습니다.', retryable: true },
  NEOPLE_API_ERROR: { message: '캐릭터 검색 중 오류가 발생했습니다.', retryable: true },
  NEOPLE_UNAVAILABLE: {
    message: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true
  },
  NEOPLE_TIMEOUT: {
    message: '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.',
    retryable: true
  },
  SEARCH_TIMEOUT: { message: '검색 시간이 초과됐습니다. 다시 시도해 주세요.', retryable: true },
  SEARCH_NETWORK_ERROR: {
    message: '검색 서버에 연결하지 못했습니다. 다시 시도해 주세요.',
    retryable: true
  },
  SEARCH_RESPONSE_INVALID: {
    message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.',
    retryable: true
  }
} as const satisfies Record<string, SearchErrorDefinition>

export type SearchErrorCode = keyof typeof SEARCH_ERRORS
export type SearchError = Readonly<{ code: SearchErrorCode }>

export const SEARCH_SLOT_STATES = ['idle', 'pending', 'success', 'empty', 'failure'] as const
type SearchSlotState = (typeof SEARCH_SLOT_STATES)[number]

export type SearchSlot = Readonly<{
  slot: number
  observationRevision: number
  requestId: string | null
  nickname: string | null
  state: SearchSlotState
  rows: readonly CharacterSearchRow[]
  error: SearchError | null
  selected?: SelectedCharacterSummary
  selectionMethod?: CharacterSelectionMethod
  choices?: readonly CharacterChoice[]
  details?: SelectedDetailsState
}>

export type SearchSnapshot = Readonly<{
  revision: number
  captureId: string | null
  slots: readonly SearchSlot[]
}>

export const SEARCH_COMMAND_ERRORS = {
  INVALID_SEARCH_COMMAND: 'INVALID_SEARCH_COMMAND',
  SEARCH_NOT_ALLOWED: 'SEARCH_NOT_ALLOWED',
  STALE_SEARCH: 'STALE_SEARCH',
  SEARCH_RETRY_NOT_READY: 'SEARCH_RETRY_NOT_READY'
} as const

export type SearchCommandError = (typeof SEARCH_COMMAND_ERRORS)[keyof typeof SEARCH_COMMAND_ERRORS]

export type SearchCommandResult =
  | Readonly<{ ok: true; snapshot: SearchSnapshot }>
  | Readonly<{ ok: false; error: { code: SearchCommandError }; snapshot: SearchSnapshot }>

export type SearchApi = {
  controlCharacterSearch: (control: SearchControl) => Promise<SearchCommandResult>
  onCharacterSearchChanged: (listener: (snapshot: SearchSnapshot) => void) => () => void
}
