import type { AuthClock } from '../auth/types'
import type { CharacterSearchRow, OcrSearchInput } from '../../preload/common/types/search'
import type {
  CharacterDetails,
  CharacterSummary,
  CharacterJsonValue,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import { createCharacterIdentifier, type IdentificationServices } from './identify'
import { SearchHttpFailure, type SearchHttp } from './http'
import type {
  CharacterCandidatesHttp,
  CharacterDetailsHttp,
  CharacterImageHttp
} from './character-http'
import type { StayImageSource } from './stay-images'
import { runSearchOperation, type SearchOperation, type SearchOperationFailure } from './operation'

export type PortraitMatcher = (input: {
  portrait: CharacterPortrait
  candidate: CharacterImage
  signal: AbortSignal
}) => Promise<boolean>

export type IdentificationAdapters = {
  candidates: CharacterCandidatesHttp
  image: CharacterImageHttp | StayImageSource
  details: CharacterDetailsHttp
  matchesPortrait: PortraitMatcher
}

export type SearchRuntime = {
  http: SearchHttp
  clock: AuthClock
  identification?: IdentificationAdapters
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
    (execution) =>
      execution.run((signal) => input.runtime.http({ nickname: input.nickname, signal }))
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
  const adapters = input.runtime.identification
  if (adapters === undefined) {
    return {
      kind: 'failure',
      error: { code: 'NEOPLE_UNAVAILABLE', retryAfterSeconds: null },
      retryAfterReceivedAt: null
    }
  }
  const outcome = await runSearchOperation(
    {
      clock: input.runtime.clock,
      startedAt: input.startedAt,
      signal: input.signal,
      isCurrent: input.isCurrent
    },
    (execution) => {
      const services = bindIdentificationServices(adapters, execution)
      const identify = createCharacterIdentifier(services)

      return identify({ nicknames: ocr.candidateNicknames, portrait: ocr.portrait })
    }
  )
  if (outcome === null || outcome.kind === 'failure') {
    return outcome
  }

  if (outcome.value.kind === 'invalid-input') {
    return {
      kind: 'failure',
      error: { code: 'INVALID_SEARCH_QUERY', retryAfterSeconds: null },
      retryAfterReceivedAt: null
    }
  }

  if (outcome.value.kind === 'appearance-unavailable') {
    return {
      kind: 'failure',
      error: { code: 'SEARCH_APPEARANCE_UNAVAILABLE', retryAfterSeconds: null },
      retryAfterReceivedAt: null
    }
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

/** 요청의 실행 관리를 결합하고 식별 규칙에는 업무 연산만 전달한다. */
function bindIdentificationServices(
  adapters: IdentificationAdapters,
  execution: SearchOperation
): IdentificationServices {
  return {
    findCandidates: (nickname) =>
      execution.run((signal) => adapters.candidates({ nickname, signal })),
    loadPortraits: (identity) =>
      execution.run(async (signal) => {
        const source = await adapters.image({ ...identity, signal })
        if ('kind' in source) {
          if (source.kind === 'unavailable') {
            return null
          }

          return source.images
        }

        return [source]
      }),
    getDetails: (identity) => execution.run((signal) => adapters.details({ ...identity, signal })),
    matchesPortrait: (input) =>
      execution.run(async (signal) => {
        try {
          return await adapters.matchesPortrait({ ...input, signal })
        } catch {
          // 비교 입력이나 연산 한도 문제를 불일치로 숨겨 다음 후보를 선택하지 않는다.
          throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
        }
      })
  }
}
