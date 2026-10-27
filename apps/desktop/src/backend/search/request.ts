import { isFiniteNumber } from '@dfragon/lib/utils/shape-check'
import type { MonotonicClock } from '../lib/monotonic-clock'
import type {
  CharacterChoice,
  CharacterSearchRow,
  CharacterSelectionMethod,
  OcrSearchInput
} from '../../preload/common/types/search'
import type {
  CharacterCandidate,
  SelectedCharacterSummary,
  CharacterJsonValue
} from '../../preload/common/types/character'
import {
  createCharacterIdentifier,
  createManualCharacterLookup,
  createRaidCharacterIdentifier,
  type CharacterIdentification,
  type CharacterSelectionPolicy,
  type IdentificationServices,
  type RaidIdentificationServices
} from './identify'
import { toRaidObservedValues } from './raid-candidate'
import { SearchHttpFailure, type SearchHttp } from './http'
import type {
  CharacterCandidatesHttp,
  CharacterDetailsHttp,
  CharacterImageHttp
} from './character-http'
import type { PortraitColorScorer } from './portrait-color'
import { runSearchOperation, type SearchOperation, type SearchOperationFailure } from './operation'
import { buildCharacterCard } from './card-assembler'
import type { ScoreEngine } from '../score/engine'

export type IdentificationAdapters = {
  candidates: CharacterCandidatesHttp
  image: CharacterImageHttp
  details: CharacterDetailsHttp
  scorePortrait: PortraitColorScorer
  selection: CharacterSelectionPolicy
}

export type SearchRuntime = {
  http: SearchHttp
  clock: MonotonicClock
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
        selectionMethod: CharacterSelectionMethod
        choices?: readonly CharacterChoice[]
        /** 이름과 서버만 정했고 상세와 점수는 아직 채우지 않았다. */
        details?: 'pending'
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
  if (isFiniteNumber(value)) {
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

/**
 * OCR 입력은 일반 검색으로 대체하지 않고 선택된 한 캐릭터만 공개 요약으로 투영한다. OCR 식별은 이름과 서버만
 * 정하고 상세는 수명이 다른 슬롯의 식별을 마친 뒤 `runDetailsRequest`로 채운다. 사용자가 서버를 정한 조회는
 * 같은 요청에서 상세까지 채운다.
 */
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
      const identified = await identifyCharacter(input, services, adapters.selection)
      if (identified.kind !== 'matched' || input.manualServerId === undefined) {
        return { identified, summary: null }
      }
      const base = candidateSummary(identified.candidate)
      const summary = await loadDetailsSummary(base, adapters, execution, input.runtime.score)

      return { identified, summary }
    }
  )
  if (outcome === null || outcome.kind === 'failure') {
    return outcome
  }
  const { identified, summary } = outcome.value

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
  const { candidate, selectionMethod, choices } = identified
  const { characterId, characterName, serverId, serverName, fame } = candidate
  const rows = [{ characterId, characterName, serverId, serverName, fame }]
  const selected =
    summary === null
      ? { summary: candidateSummary(candidate), selectionMethod, details: 'pending' as const }
      : { summary, selectionMethod }

  if (choices === undefined) {
    return { kind: 'success', rows, selected }
  }

  return { kind: 'success', rows, selected: { ...selected, choices } }
}

export type DetailsOutcome =
  | { kind: 'success'; summary: SelectedCharacterSummary }
  | SearchOperationFailure
  | null

/** 이름과 서버를 정한 요약에 그 캐릭터의 상세와 점수를 채운다. 요청마다 처음 접수부터 같은 예산을 쓴다. */
export async function runDetailsRequest(input: {
  runtime: SearchRuntime
  summary: SelectedCharacterSummary
  startedAt: number
  signal: AbortSignal
  isCurrent: () => boolean
}): Promise<DetailsOutcome> {
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
    (execution) => loadDetailsSummary(input.summary, adapters, execution, input.runtime.score)
  )
  if (outcome === null || outcome.kind === 'failure') {
    return outcome
  }

  return { kind: 'success', summary: outcome.value }
}

/** 후보 검색 응답만으로 만든 요약. 상세에만 있는 레벨, 길드와 카드는 아직 모른다. */
function candidateSummary(candidate: CharacterCandidate): SelectedCharacterSummary {
  return {
    characterId: candidate.characterId,
    characterName: candidate.characterName,
    serverId: candidate.serverId,
    serverName: candidate.serverName,
    adventureName: candidate.adventureName,
    jobName: candidate.jobName,
    jobGrowName: candidate.jobGrowName,
    level: null,
    fame: candidate.fame,
    imageUrl: candidate.imageUrl,
    guildName: null,
    equipmentScore: null,
    card: null
  }
}

async function loadDetailsSummary(
  base: SelectedCharacterSummary,
  adapters: IdentificationAdapters,
  execution: SearchOperation,
  score: ScoreEngine | undefined
): Promise<SelectedCharacterSummary> {
  const identity = { serverId: base.serverId, characterId: base.characterId }
  const details = await execution.run((signal) => adapters.details({ ...identity, signal }))
  // 엔진 호출도 같은 예산과 취소 판정 안에서 실행해 늦은 결과를 버린다.
  const card = await execution.run(async () => buildCharacterCard(details, score ?? null))
  const character = details.character
  const adventureName = displayText(character.adventureName)
  const jobName = displayText(character.jobName)
  const jobGrowName = displayText(character.jobGrowName)
  const level = displayNumber(character.level)
  const fame = displayNumber(character.fame)
  const guildName = displayText(character.guildName)
  const equipmentScore = card?.score?.value ?? null

  return {
    characterId: character.characterId,
    characterName: character.characterName,
    serverId: character.serverId,
    serverName: character.serverName,
    adventureName,
    jobName,
    jobGrowName,
    level,
    fame,
    imageUrl: base.imageUrl,
    guildName,
    equipmentScore,
    card
  }
}

function identifyCharacter(
  input: RequestInput,
  services: IdentificationServices & RaidIdentificationServices,
  selection: CharacterSelectionPolicy
): Promise<CharacterIdentification> {
  if (input.manualServerId !== undefined) {
    const lookup = createManualCharacterLookup(services)

    return lookup({ nickname: input.nickname, serverId: input.manualServerId })
  }
  const nicknames = input.ocrInput?.candidateNicknames ?? []
  if (input.runtime.ocrIdentification === 'raid') {
    const identifyRaid = createRaidCharacterIdentifier(services)
    const observed = toRaidObservedValues(input.ocrInput?.raidRow)

    return identifyRaid({ nicknames, observed })
  }
  const identify = createCharacterIdentifier(services, selection)
  const portrait = input.ocrInput?.portrait ?? null

  return identify({ nicknames, portrait })
}

/** 요청의 실행 관리를 결합하고 식별 규칙에는 업무 연산만 전달한다. */
function bindIdentificationServices(
  adapters: IdentificationAdapters,
  execution: SearchOperation
): IdentificationServices & RaidIdentificationServices {
  return {
    findCandidates: (nickname) =>
      execution.run((signal) => adapters.candidates({ nickname, signal })),
    loadPortrait: (identity) =>
      execution.run(async (signal) => {
        try {
          return await adapters.image({ ...identity, signal })
        } catch (error) {
          if (error instanceof SearchHttpFailure && error.code === 'SEARCH_RATE_LIMITED') {
            throw error
          }
          // 이미지 실패는 명성 대체 표시로 이어지되 취소와 만료는 실행 계층이 판정한다.

          return null
        }
      }),
    scorePortrait: (input) =>
      execution.run(async (signal) => {
        try {
          return await adapters.scorePortrait({ ...input, signal })
        } catch {
          // 계산 예산 초과 같은 비교 실패는 다른 후보의 일치로 확정하지 않고 명성 대체 표시로 보낸다.
          return null
        }
      })
  }
}
