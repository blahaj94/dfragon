import type { AuthClock } from '../auth/types'
import type { CharacterSearchRow, OcrSearchInput } from '../../preload/common/types/search'
import type {
  CharacterDetails,
  CharacterSummary,
  CharacterJsonValue
} from '../../preload/common/types/character'
import type { createCharacterIdentifier } from './identify'
import type { SearchHttp } from './http'
import { runSearchOperation, type SearchOperationFailure } from './operation'

export type SearchRuntime = {
  http: SearchHttp
  clock: AuthClock
  identify?: ReturnType<typeof createCharacterIdentifier>
}
export type SearchOutcome =
  | {
      kind: 'success'
      rows: readonly CharacterSearchRow[]
      selected?: { summary: CharacterSummary; details: CharacterDetails }
    }
  | SearchOperationFailure
  | null

type RequestInput = {
  runtime: SearchRuntime
  nickname: string
  startedAt: number
  signal: AbortSignal
  isCurrent: () => boolean
  ocrInput?: OcrSearchInput
}

function displayText(value: CharacterJsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  return null
}

function displayNumber(value: CharacterJsonValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

/** 기존 일반 검색을 공통 요청 예산으로 실행하고 기존 rows 응답을 유지한다. */
export async function runSearchRequest(input: RequestInput): Promise<SearchOutcome> {
  if (input.ocrInput !== undefined) {
    return runIdentificationRequest(input, input.ocrInput)
  }
  const outcome = await runSearchOperation(
    {
      clock: input.runtime.clock,
      startedAt: input.startedAt,
      signal: input.signal,
      isCurrent: input.isCurrent
    },
    (signal) => input.runtime.http({ nickname: input.nickname, signal })
  )
  if (outcome === null || outcome.kind === 'failure') {
    return outcome
  }

  return { kind: 'success', rows: outcome.value }
}

/** OCR 입력은 일반 검색으로 대체하지 않고 선택된 한 캐릭터만 공개 요약으로 투영한다. */
async function runIdentificationRequest(
  input: RequestInput,
  ocr: OcrSearchInput
): Promise<SearchOutcome> {
  const identify = input.runtime.identify
  if (identify === undefined) {
    return {
      kind: 'failure',
      error: { code: 'NEOPLE_UNAVAILABLE', retryAfterSeconds: null },
      retryAfterReceivedAt: null
    }
  }
  const outcome = await identify({
    clock: input.runtime.clock,
    startedAt: input.startedAt,
    signal: input.signal,
    isCurrent: input.isCurrent,
    nicknames: ocr.candidateNicknames,
    portrait: ocr.portrait
  })
  if (outcome === null || outcome.kind === 'failure') {
    return outcome
  }

  if (outcome.value.kind !== 'matched') {
    return { kind: 'success', rows: [] }
  }
  const { candidate, details } = outcome.value
  const { characterId, characterName, serverId, serverName, fame } = candidate
  const rows = [{ characterId, characterName, serverId, serverName, fame }]
  const character = details.character
  const adventureName = displayText(character.adventureName)
  const jobName = displayText(character.jobName)
  const jobGrowName = displayText(character.jobGrowName)
  const level = displayNumber(character.level)
  const detailFame = displayNumber(character.fame)
  const summary: CharacterSummary = {
    characterId: character.characterId,
    characterName: character.characterName,
    serverId: character.serverId,
    serverName: character.serverName,
    adventureName,
    jobName,
    jobGrowName,
    level,
    fame: detailFame,
    imageUrl: candidate.imageUrl
  }

  return { kind: 'success', rows, selected: { summary, details } }
}
