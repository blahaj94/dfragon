import type {
  CharacterChoice,
  CharacterFaceWindow,
  CharacterSelectionMethod
} from '../../preload/common/types/search'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterIdentity,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import { orderedCandidates } from './candidate-order'
import {
  planRaidComparison,
  selectRaidCandidate,
  type RaidEquipmentScore,
  type RaidObservedValues
} from './raid-candidate'

const MAX_OCR_NAMES = 2
const MAX_NAME_CODE_POINTS = 12

/** 얼굴과 후보 이미지의 거리와 얼굴을 맞춘 후보 이미지 안의 창 */
type PortraitScore = Readonly<{ distance: number; alignment: CharacterFaceWindow }>

export type IdentificationServices = {
  findCandidates: (nickname: string) => Promise<readonly CharacterCandidate[]>
  /** 후보 한 명의 비교용 이미지. 받지 못하면 null이다. */
  loadPortrait: (identity: CharacterIdentity) => Promise<CharacterImage | null>
  getDetails: (identity: CharacterIdentity) => Promise<CharacterDetails>
  /**
   * 얼굴과 후보 이미지의 거리와 얼굴을 맞춘 후보 이미지 안의 창. 비교할 수 없으면 null이며 거리는 확률이
   * 아니다.
   */
  scorePortrait: (input: {
    portrait: CharacterPortrait
    candidate: CharacterImage
  }) => Promise<PortraitScore | null>
}

/**
 * 얼굴 거리로 고른 1위를 확정할지 정하는 기준. 거리는 `scorePortrait`가 돌려주는 값과 같은 단위다. 기준을
 * 넘지 못해도 1위를 고르며, 그때는 사용자가 고를 후보를 함께 돌려준다.
 */
export type CharacterSelectionPolicy = Readonly<{
  /** 1위를 확정하는 거리 상한(포함). */
  maxDistance: number
  /** 1위를 확정하는 1위와 2위의 거리 차이 하한(포함). */
  minMargin: number
  /** 명성 순으로 비교할 후보 수. 2위와 비교해야 하므로 2 이상이다. */
  maxCandidates: number
}>

export type CharacterIdentification =
  | { kind: 'invalid-input' }
  | { kind: 'unmatched' }
  | {
      kind: 'matched'
      candidate: CharacterCandidate
      details: CharacterDetails
      nickname: string
      selectionMethod: CharacterSelectionMethod
      /** 얼굴이나 공대 행 값으로 확정하지 못했을 때 사용자가 고를 후보. 확정한 선택에는 없다. */
      choices?: readonly CharacterChoice[]
    }

export type CharacterIdentificationInput = {
  nicknames: readonly string[]
  portrait: CharacterPortrait | null
}

/** 검색 가능한 원문만 허용하고 두 번째 OCR 후보로 보정하지 않는다. */
export function isCharacterSearchNickname(nickname: string | undefined): nickname is string {
  if (nickname === undefined) {
    return false
  }
  const length = [...nickname].length

  return (
    length > 0 &&
    length <= MAX_NAME_CODE_POINTS &&
    nickname === nickname.trim() &&
    nickname.isWellFormed()
  )
}

/** 식별 기준이 계약 범위인지 확인한다. 등록 시점 검증과 식별기 생성이 함께 쓴다. */
export function validateSelectionPolicy(policy: CharacterSelectionPolicy): void {
  if (
    policy == null ||
    !Number.isFinite(policy.maxDistance) ||
    policy.maxDistance < 0 ||
    !Number.isFinite(policy.minMargin) ||
    policy.minMargin < 0 ||
    !Number.isSafeInteger(policy.maxCandidates) ||
    policy.maxCandidates < 2
  ) {
    throw new TypeError('Invalid character selection policy')
  }
}

/**
 * 첫 이름의 명성 상위 후보 전원의 얼굴 거리를 구해 가장 가까운 후보를 고른다. 거리를 하나도 구하지 못하면
 * 최고 명성 후보를 고른다. 1위가 거리 상한과 2위와의 차이를 모두 만족하고 비교한 후보 전원의 거리가 있을
 * 때만 확정하고, 그 밖에는 사용자가 고를 후보를 함께 돌려준다.
 */
export function createCharacterIdentifier(
  services: IdentificationServices,
  policy: CharacterSelectionPolicy
) {
  validateSelectionPolicy(policy)
  const { maxDistance, minMargin, maxCandidates } = policy
  const accepted = { maxDistance, minMargin, maxCandidates }

  return async (input: CharacterIdentificationInput): Promise<CharacterIdentification> => {
    const nickname = input.nicknames[0]
    if (input.nicknames.length > MAX_OCR_NAMES || !isCharacterSearchNickname(nickname)) {
      return { kind: 'invalid-input' }
    }
    const candidates = orderedCandidates(await services.findCandidates(nickname))
    const highest = candidates[0]
    if (highest === undefined) {
      return { kind: 'unmatched' }
    }

    // 동명 후보가 한 명이면 고를 후보가 없어 이미지를 받지 않는다.
    if (candidates.length === 1) {
      return selectCandidate(services, highest, nickname, 'highest-fame')
    }
    const compared = candidates.slice(0, accepted.maxCandidates)
    const scores = await scoreCandidates(services, input.portrait, compared)
    const best = closestScore(scores)
    if (best === null) {
      const choices = candidates.map((candidate) => toChoice(candidate, null))

      return selectCandidate(services, highest, nickname, 'highest-fame', choices)
    }

    if (isConfident(accepted, scores, best)) {
      return selectCandidate(services, best.candidate, nickname, 'portrait')
    }
    const choices = scores.map(({ candidate, score }) =>
      toChoice(candidate, score?.alignment ?? null)
    )

    return selectCandidate(services, best.candidate, nickname, 'portrait', choices)
  }
}

type CandidateScore = Readonly<{
  candidate: CharacterCandidate
  score: PortraitScore | null
}>
type ScoredCandidate = Readonly<{
  candidate: CharacterCandidate
  score: PortraitScore
}>

/** 이미지나 점수를 얻지 못한 후보도 나머지 후보의 비교를 막지 않고 점수 없음으로 남긴다. */
async function scoreCandidates(
  services: Pick<IdentificationServices, 'loadPortrait' | 'scorePortrait'>,
  portrait: CharacterPortrait | null,
  candidates: readonly CharacterCandidate[]
): Promise<CandidateScore[]> {
  if (portrait === null) {
    return candidates.map((candidate) => ({ candidate, score: null }))
  }
  const scores: CandidateScore[] = []
  for (const candidate of candidates) {
    const identity = { serverId: candidate.serverId, characterId: candidate.characterId }
    const image = await services.loadPortrait(identity)
    if (image === null) {
      scores.push({ candidate, score: null })
      continue
    }
    const score = await services.scorePortrait({ portrait, candidate: image })
    scores.push({ candidate, score })
  }

  return scores
}

/** 거리가 같으면 명성 순서가 앞선 후보가 1위다. */
function closestScore(scores: readonly CandidateScore[]): ScoredCandidate | null {
  let best: ScoredCandidate | null = null
  for (const { candidate, score } of scores) {
    if (score !== null && (best === null || score.distance < best.score.distance)) {
      best = { candidate, score }
    }
  }

  return best
}

function isConfident(
  policy: CharacterSelectionPolicy,
  scores: readonly CandidateScore[],
  best: ScoredCandidate
): boolean {
  const others = scores.filter(({ candidate }) => candidate !== best.candidate)
  if (others.some(({ score }) => score === null)) {
    return false
  }
  const runnerUp = Math.min(...others.map(({ score }) => score?.distance ?? Infinity))
  const bestDistance = best.score.distance

  return bestDistance <= policy.maxDistance && runnerUp - bestDistance >= policy.minMargin
}

function toChoice(
  candidate: CharacterCandidate,
  face: CharacterFaceWindow | null
): CharacterChoice {
  const { characterId, characterName, serverId, serverName, fame, adventureName } = candidate

  return { characterId, characterName, serverId, serverName, fame, adventureName, face }
}

/** 공대 식별이 장비 점수를 비교할 때 쓰는 업무 연산 */
export type RaidIdentificationServices = Pick<
  IdentificationServices,
  'findCandidates' | 'getDetails'
> & {
  /** 장비 점수를 비교할 후보의 상세. 요청 한도로 받지 못하면 null이고 그 후보만 점수 없음이다. */
  findComparisonDetails: (identity: CharacterIdentity) => Promise<CharacterDetails | null>
  /** 상세로 계산한 장비 점수. 엔진이 없거나 계산하지 못하면 null이다. */
  scoreEquipment: (details: CharacterDetails) => Promise<number | null>
}

/**
 * 공대 캡처의 OCR 첫 이름으로 후보를 찾고 그 행의 직업명과 수치로 캐릭터를 골라 상세를 조회한다. 공대 상세
 * 창에는 얼굴이 없어 외형을 비교하지 않는다. 장비 점수를 비교하면 대상 후보의 상세를 한 명씩 차례로 조회하고,
 * 고른 후보의 상세가 그중에 있으면 다시 조회하지 않는다.
 */
export function createRaidCharacterIdentifier(services: RaidIdentificationServices) {
  return async (input: {
    nicknames: readonly string[]
    observed: RaidObservedValues
  }): Promise<CharacterIdentification> => {
    const nickname = input.nicknames[0]
    if (input.nicknames.length > MAX_OCR_NAMES || !isCharacterSearchNickname(nickname)) {
      return { kind: 'invalid-input' }
    }
    const candidates = await services.findCandidates(nickname)
    const plan = planRaidComparison({ observed: input.observed, candidates })
    if (plan === null) {
      return { kind: 'unmatched' }
    }
    const loaded = new Map<CharacterCandidate, CharacterDetails>()
    const scores: RaidEquipmentScore[] = []
    if (plan.kind === 'equipment-score') {
      for (const candidate of plan.targets) {
        const identity = { serverId: candidate.serverId, characterId: candidate.characterId }
        const details = await services.findComparisonDetails(identity)
        if (details === null) {
          scores.push({ candidate, score: null })
          continue
        }
        loaded.set(candidate, details)
        scores.push({ candidate, score: await services.scoreEquipment(details) })
      }
    }
    const { candidate, selectionMethod, choices } = selectRaidCandidate(plan, scores)
    const raidChoices = choices?.map((choice) => toChoice(choice, null))
    const details = loaded.get(candidate)
    if (details === undefined) {
      return selectCandidate(services, candidate, nickname, selectionMethod, raidChoices)
    }

    return toMatchedIdentification(candidate, details, nickname, selectionMethod, raidChoices)
  }
}

/** 사용자가 지정한 서버와 이름이 모두 일치하는 캐릭터만 선택한다. */
export function createManualCharacterLookup(
  services: Pick<IdentificationServices, 'findCandidates' | 'getDetails'>
) {
  return async (input: {
    nickname: string
    serverId: string
  }): Promise<CharacterIdentification> => {
    if (!isCharacterSearchNickname(input.nickname)) {
      return { kind: 'invalid-input' }
    }
    const candidates = await services.findCandidates(input.nickname)
    const candidate = candidates.find(
      (candidate) =>
        candidate.serverId === input.serverId && candidate.characterName === input.nickname
    )
    if (candidate === undefined) {
      return { kind: 'unmatched' }
    }

    return selectCandidate(services, candidate, input.nickname, 'manual')
  }
}

async function selectCandidate(
  services: Pick<IdentificationServices, 'getDetails'>,
  candidate: CharacterCandidate,
  nickname: string,
  selectionMethod: CharacterSelectionMethod,
  choices?: readonly CharacterChoice[]
): Promise<CharacterIdentification> {
  const identity = { serverId: candidate.serverId, characterId: candidate.characterId }
  const details = await services.getDetails(identity)

  return toMatchedIdentification(candidate, details, nickname, selectionMethod, choices)
}

function toMatchedIdentification(
  candidate: CharacterCandidate,
  details: CharacterDetails,
  nickname: string,
  selectionMethod: CharacterSelectionMethod,
  choices: readonly CharacterChoice[] | undefined
): CharacterIdentification {
  if (choices === undefined) {
    return { kind: 'matched', candidate, details, nickname, selectionMethod }
  }

  return { kind: 'matched', candidate, details, nickname, selectionMethod, choices }
}
