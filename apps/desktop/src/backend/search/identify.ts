import type {
  CharacterChoice,
  CharacterFaceWindow,
  CharacterSelectionMethod
} from '../../preload/common/types/search'
import type {
  CharacterCandidate,
  CharacterIdentity,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import { orderedCandidates } from './candidate-order'
import {
  portraitAnchorOf,
  portraitFaceWindowOf,
  type PortraitAnchor
} from '../../preload/common/search/portrait-anchor'
import { planRaidComparison, selectRaidCandidate, type RaidObservedValues } from './raid-candidate'

const MAX_OCR_NAMES = 2
const MAX_NAME_CODE_POINTS = 12

type PortraitScore = Readonly<{ distance: number; alignment: CharacterFaceWindow }>

export type IdentificationServices = {
  findCandidates: (nickname: string) => Promise<readonly CharacterCandidate[]>
  loadPortrait: (identity: CharacterIdentity) => Promise<CharacterImage | null>
  scorePortrait: (input: {
    portrait: CharacterPortrait
    candidate: CharacterImage
    anchor: PortraitAnchor | null
  }) => Promise<PortraitScore | null>
}

export type CharacterSelectionPolicy = Readonly<{
  maxDistance: number
  minMargin: number
  maxCandidates: number
}>

export type CharacterIdentification =
  | { kind: 'invalid-input' }
  | { kind: 'unmatched' }
  | {
      kind: 'matched'
      candidate: CharacterCandidate
      nickname: string
      selectionMethod: CharacterSelectionMethod
      choices?: readonly CharacterChoice[]
    }

export type CharacterIdentificationInput = {
  nicknames: readonly string[]
  portrait: CharacterPortrait | null
}

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

export function createCharacterIdentifier(
  services: IdentificationServices,
  policy: CharacterSelectionPolicy
) {
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

    if (candidates.length === 1) {
      return toMatchedIdentification(highest, nickname, 'highest-fame', undefined)
    }
    const compared = candidates.slice(0, policy.maxCandidates)
    const scores = await scoreCandidates(services, input.portrait, compared)
    const best = closestScore(scores)
    if (best === null) {
      const choices = candidates.map((candidate) =>
        toChoice(candidate, portraitFaceWindowOf(candidate.jobName))
      )

      return toMatchedIdentification(highest, nickname, 'highest-fame', choices)
    }

    if (isConfident(policy, scores, best)) {
      return toMatchedIdentification(best.candidate, nickname, 'portrait', undefined)
    }
    const choices = scores.map(({ candidate, score }) =>
      toChoice(candidate, score?.alignment ?? portraitFaceWindowOf(candidate.jobName))
    )

    return toMatchedIdentification(best.candidate, nickname, 'portrait', choices)
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
    const anchor = portraitAnchorOf(candidate.jobName)
    const score = await services.scorePortrait({ portrait, candidate: image, anchor })
    scores.push({ candidate, score })
  }

  return scores
}

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

export type RaidIdentificationServices = Pick<IdentificationServices, 'findCandidates'>

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
    const { candidate, selectionMethod, choices } = selectRaidCandidate(plan)
    const raidChoices = choices?.map((choice) => toChoice(choice, null))

    return toMatchedIdentification(candidate, nickname, selectionMethod, raidChoices)
  }
}

export function createManualCharacterLookup(
  services: Pick<IdentificationServices, 'findCandidates'>
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

    return toMatchedIdentification(candidate, input.nickname, 'manual', undefined)
  }
}

function toMatchedIdentification(
  candidate: CharacterCandidate,
  nickname: string,
  selectionMethod: CharacterSelectionMethod,
  choices: readonly CharacterChoice[] | undefined
): CharacterIdentification {
  if (choices === undefined) {
    return { kind: 'matched', candidate, nickname, selectionMethod }
  }

  return { kind: 'matched', candidate, nickname, selectionMethod, choices }
}
