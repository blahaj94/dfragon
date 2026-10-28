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
import { SearchHttpFailure } from './http'
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
  clock: MonotonicClock
  identification: IdentificationAdapters
  ocrIdentification?: 'portrait' | 'raid'
  score: ScoreEngine
}
export type SearchOutcome =
  | {
      kind: 'success'
      rows: readonly CharacterSearchRow[]
      selected?: {
        summary: SelectedCharacterSummary
        selectionMethod: CharacterSelectionMethod
        choices?: readonly CharacterChoice[]
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

export async function runSearchRequest(input: RequestInput): Promise<SearchOutcome> {
  const adapters = input.runtime.identification
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

export async function runDetailsRequest(input: {
  runtime: SearchRuntime
  summary: SelectedCharacterSummary
  startedAt: number
  signal: AbortSignal
  isCurrent: () => boolean
}): Promise<DetailsOutcome> {
  const adapters = input.runtime.identification
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
  score: ScoreEngine
): Promise<SelectedCharacterSummary> {
  const identity = { serverId: base.serverId, characterId: base.characterId }
  const details = await execution.run((signal) => adapters.details({ ...identity, signal }))
  // 엔진 호출도 같은 예산과 취소 판정 안에서 실행해 늦은 결과를 버린다.
  const card = await execution.run(async () => buildCharacterCard(details, score))
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
