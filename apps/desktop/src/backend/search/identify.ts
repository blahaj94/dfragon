import type { CharacterSelectionMethod } from '../../preload/common/types/search'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterIdentity,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import { orderedCandidates } from './candidate-order'
import { selectRaidCandidate, type RaidObservedValues } from './raid-candidate'

const MAX_OCR_NAMES = 2
const MAX_NAME_CODE_POINTS = 12

export type IdentificationServices = {
  findCandidates: (nickname: string) => Promise<readonly CharacterCandidate[]>
  /** 후보 한 명의 비교용 이미지. 받지 못하면 null이다. */
  loadPortrait: (identity: CharacterIdentity) => Promise<CharacterImage | null>
  getDetails: (identity: CharacterIdentity) => Promise<CharacterDetails>
  /** 얼굴과 후보 이미지의 거리. 비교할 수 없으면 null이며 거리는 확률이 아니다. */
  scorePortrait: (input: {
    portrait: CharacterPortrait
    candidate: CharacterImage
  }) => Promise<Readonly<{ distance: number }> | null>
}

/** 얼굴 거리로 후보를 고르는 기준. 거리는 `scorePortrait`가 돌려주는 값과 같은 단위다. */
export type CharacterSelectionPolicy = Readonly<{
  /** 1위 후보의 거리 상한(포함). */
  maxDistance: number
  /** 1위와 2위의 거리 차이 하한(포함). */
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
 * 첫 이름의 명성 상위 후보 전원의 얼굴 거리를 구한 뒤, 가장 가까운 후보가 거리 상한과 2위와의 차이를
 * 모두 만족할 때만 얼굴로 선택한다. 그 밖에는 최고 명성 후보를 제시한다.
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
    const portrait = input.portrait
    if (portrait !== null) {
      const compared = candidates.slice(0, accepted.maxCandidates)
      const matched = await findPortraitMatch(services, accepted, portrait, compared)
      if (matched !== null) {
        return selectCandidate(services, matched, nickname, 'portrait')
      }
    }

    return selectCandidate(services, highest, nickname, 'highest-fame')
  }
}

/**
 * 후보가 한 명이면 2위와 비교할 수 없어 이미지를 받지 않는다. 이미지나 점수가 하나라도 없으면 남은 후보를
 * 받지 않고 얼굴 선택을 포기한다.
 */
async function findPortraitMatch(
  services: Pick<IdentificationServices, 'loadPortrait' | 'scorePortrait'>,
  policy: CharacterSelectionPolicy,
  portrait: CharacterPortrait,
  candidates: readonly CharacterCandidate[]
): Promise<CharacterCandidate | null> {
  if (candidates.length < 2) {
    return null
  }
  const distances: number[] = []
  for (const candidate of candidates) {
    const identity = { serverId: candidate.serverId, characterId: candidate.characterId }
    const image = await services.loadPortrait(identity)
    if (image === null) {
      return null
    }
    const score = await services.scorePortrait({ portrait, candidate: image })
    if (score === null) {
      return null
    }
    distances.push(score.distance)
  }
  // 거리가 같으면 명성 순서가 앞선 후보가 1위이고, 차이가 0이라 minMargin이 0일 때만 선택된다.
  let best = 0
  for (let index = 1; index < distances.length; index += 1) {
    if (distances[index] < distances[best]) {
      best = index
    }
  }
  const runnerUp = Math.min(...distances.filter((_, index) => index !== best))
  const bestDistance = distances[best]
  const isUnconfident =
    bestDistance > policy.maxDistance || runnerUp - bestDistance < policy.minMargin
  if (isUnconfident) {
    return null
  }

  return candidates[best]
}

/**
 * 공대 캡처의 OCR 첫 이름으로 후보를 찾고 공대 후보 선택 함수가 고른 캐릭터의 상세를 조회한다. 공대 상세
 * 창에는 얼굴이 없어 외형을 비교하지 않는다.
 */
export function createRaidCharacterIdentifier(
  services: Pick<IdentificationServices, 'findCandidates' | 'getDetails'>
) {
  return async (input: {
    nicknames: readonly string[]
    observed: RaidObservedValues
  }): Promise<CharacterIdentification> => {
    const nickname = input.nicknames[0]
    if (input.nicknames.length > MAX_OCR_NAMES || !isCharacterSearchNickname(nickname)) {
      return { kind: 'invalid-input' }
    }
    const candidates = await services.findCandidates(nickname)
    const selection = selectRaidCandidate({ name: nickname, observed: input.observed, candidates })
    if (selection === null) {
      return { kind: 'unmatched' }
    }

    return selectCandidate(services, selection.candidate, nickname, selection.selectionMethod)
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
  selectionMethod: CharacterSelectionMethod
): Promise<CharacterIdentification> {
  const identity = { serverId: candidate.serverId, characterId: candidate.characterId }
  const details = await services.getDetails(identity)

  return { kind: 'matched', candidate, details, nickname, selectionMethod }
}
