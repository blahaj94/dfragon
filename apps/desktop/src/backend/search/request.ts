import type { AuthClock } from '../auth/types'
import type {
  CharacterSearchRow,
  CharacterSelectionMethod,
  OcrSearchInput
} from '../../preload/common/types/search'
import type {
  CharacterDetails,
  SelectedCharacterSummary,
  CharacterJsonValue,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import {
  createCharacterIdentifier,
  createManualCharacterLookup,
  createRaidCharacterIdentifier,
  type CharacterIdentification,
  type IdentificationServices
} from './identify'
import { NO_RAID_OBSERVED_VALUES } from './raid-candidate'
import { SearchHttpFailure, type SearchHttp } from './http'
import type {
  CharacterCandidatesHttp,
  CharacterDetailsHttp,
  CharacterImageHttp
} from './character-http'
import type { StayImageSource } from './stay-images'
import { runSearchOperation, type SearchOperation, type SearchOperationFailure } from './operation'
import { buildCharacterCard } from './card-assembler'
import type { ScoreEngine } from '../score/engine'

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
  /**
   * OCR 이름의 식별 방식. 파티 캡처는 얼굴 비교(`portrait`, 기본), 공대 캡처는 공대 후보 선택 함수(`raid`)를
   * 쓴다. 공대 검색 수명만 `raid`로 둔다.
   */
  ocrIdentification?: 'portrait' | 'raid'
  /** 선택한 캐릭터의 점수 계산. 엔진이 없으면 생략하고 카드는 점수 없이 표시한다. */
  score?: ScoreEngine
}
export type SearchOutcome =
  | {
      kind: 'success'
      rows: readonly CharacterSearchRow[]
      selected?: {
        summary: SelectedCharacterSummary
        details: CharacterDetails
        selectionMethod: CharacterSelectionMethod
      }
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
  manualServerId?: string
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
  if (input.ocrInput !== undefined || input.manualServerId !== undefined) {
    return runIdentificationRequest(input)
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
async function runIdentificationRequest(input: RequestInput): Promise<SearchOutcome> {
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
    async (execution) => {
      const services = bindIdentificationServices(adapters, execution)
      const identified = await identifyCharacter(input, services)
      if (identified.kind !== 'matched') {
        return { identified, card: null }
      }
      // 엔진 호출도 같은 예산과 취소 판정 안에서 실행해 늦은 결과를 버린다.
      const score = input.runtime.score ?? null
      const card = await execution.run(async () => buildCharacterCard(identified.details, score))

      return { identified, card }
    }
  )
  if (outcome === null || outcome.kind === 'failure') {
    return outcome
  }
  const { identified, card } = outcome.value

  if (identified.kind === 'invalid-input') {
    return {
      kind: 'failure',
      error: { code: 'INVALID_SEARCH_QUERY', retryAfterSeconds: null },
      retryAfterReceivedAt: null
    }
  }

  if (identified.kind !== 'matched') {
    return { kind: 'success', rows: [] }
  }
  const { candidate, details, selectionMethod } = identified
  const { characterId, characterName, serverId, serverName, fame } = candidate
  const rows = [{ characterId, characterName, serverId, serverName, fame }]
  const character = details.character
  const adventureName = displayText(character.adventureName)
  const jobName = displayText(character.jobName)
  const jobGrowName = displayText(character.jobGrowName)
  const level = displayNumber(character.level)
  const detailFame = displayNumber(character.fame)
  const guildName = displayText(character.guildName)
  const equipmentScore = card?.score?.value ?? null
  const serverRank = card?.serverRank?.rank ?? null
  const summary: SelectedCharacterSummary = {
    characterId: character.characterId,
    characterName: character.characterName,
    serverId: character.serverId,
    serverName: character.serverName,
    adventureName,
    jobName,
    jobGrowName,
    level,
    fame: detailFame,
    imageUrl: candidate.imageUrl,
    guildName,
    equipmentScore,
    serverRank,
    card
  }

  return { kind: 'success', rows, selected: { summary, details, selectionMethod } }
}

function identifyCharacter(
  input: RequestInput,
  services: IdentificationServices
): Promise<CharacterIdentification> {
  if (input.manualServerId !== undefined) {
    const lookup = createManualCharacterLookup(services)

    return lookup({ nickname: input.nickname, serverId: input.manualServerId })
  }
  const nicknames = input.ocrInput?.candidateNicknames ?? []
  if (input.runtime.ocrIdentification === 'raid') {
    // 공대 창의 명성, 장비 점수는 아직 읽지 않아 빈 관측값을 넘긴다.
    const identifyRaid = createRaidCharacterIdentifier(services)

    return identifyRaid({ nicknames, observed: NO_RAID_OBSERVED_VALUES })
  }
  const identify = createCharacterIdentifier(services)
  const portrait = input.ocrInput?.portrait ?? null

  return identify({ nicknames, portrait })
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
        try {
          const source = await adapters.image({ ...identity, signal })
          if ('kind' in source) {
            if (source.kind === 'unavailable') {
              return null
            }

            return source.images
          }

          return [source]
        } catch (error) {
          if (error instanceof SearchHttpFailure && error.code === 'SEARCH_RATE_LIMITED') {
            throw error
          }
          // 외형 조회 실패는 명성 대체 표시로 이어지되 취소와 만료는 실행 계층이 판정한다.

          return null
        }
      }),
    getDetails: (identity) => execution.run((signal) => adapters.details({ ...identity, signal })),
    matchesPortrait: (input) =>
      execution.run(async (signal) => {
        try {
          return await adapters.matchesPortrait({ ...input, signal })
        } catch {
          // 비교 실패는 다음 후보의 일치로 확정하지 않고 명성 대체 표시로 보낸다.
          return null
        }
      })
  }
}
