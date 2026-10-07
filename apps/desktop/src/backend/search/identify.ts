import type { CharacterSelectionMethod } from '../../preload/common/types/search'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterIdentity,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'

const MAX_OCR_NAMES = 2
const MAX_NAME_CODE_POINTS = 12

export type IdentificationServices = {
  findCandidates: (nickname: string) => Promise<readonly CharacterCandidate[]>
  loadPortraits: (identity: CharacterIdentity) => Promise<readonly CharacterImage[] | null>
  getDetails: (identity: CharacterIdentity) => Promise<CharacterDetails>
  matchesPortrait: (input: {
    portrait: CharacterPortrait
    candidate: CharacterImage
  }) => Promise<boolean | null>
}

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

/** 명성이 같은 후보는 API 순서를 유지하고 null은 0을 포함한 모든 명성 뒤에 둔다. */
function orderedCandidates(candidates: readonly CharacterCandidate[]): CharacterCandidate[] {
  return candidates.toSorted((left, right) => {
    if (left.fame === right.fame) {
      return 0
    }

    if (left.fame === null) {
      return 1
    }

    if (right.fame === null) {
      return -1
    }

    return right.fame - left.fame
  })
}

/** 첫 이름의 외형을 순서대로 비교하고 확인하지 못하면 최고 명성 후보를 제시한다. */
export function createCharacterIdentifier(services: IdentificationServices) {
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
      for (const candidate of candidates) {
        const identity = { serverId: candidate.serverId, characterId: candidate.characterId }
        const images = await services.loadPortraits(identity)
        if (images === null || images.length === 0) {
          break
        }
        for (const image of images) {
          const matches = await services.matchesPortrait({ portrait, candidate: image })
          if (matches === null) {
            return selectCandidate(services, highest, nickname, 'highest-fame')
          }

          if (matches) {
            return selectCandidate(services, candidate, nickname, 'portrait')
          }
        }
      }
    }

    return selectCandidate(services, highest, nickname, 'highest-fame')
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
