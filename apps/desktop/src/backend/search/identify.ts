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
  }) => Promise<boolean>
}

export type CharacterIdentification =
  | { kind: 'invalid-input' }
  | { kind: 'portrait-unavailable' }
  | { kind: 'appearance-unavailable' }
  | { kind: 'unmatched' }
  | {
      kind: 'matched'
      candidate: CharacterCandidate
      details: CharacterDetails
      nickname: string
    }

export type CharacterIdentificationInput = {
  nicknames: readonly string[]
  portrait: CharacterPortrait | null
}

/** 순위는 유지하고 검색할 수 없는 빈 OCR 후보와 같은 이름의 반복만 제외한다. */
function searchableNames(nicknames: readonly string[]): string[] {
  const names: string[] = []
  for (const nickname of nicknames) {
    const length = [...nickname].length
    const valid =
      length > 0 &&
      length <= MAX_NAME_CODE_POINTS &&
      nickname === nickname.trim() &&
      nickname.isWellFormed()
    if (valid && !names.includes(nickname)) {
      names.push(nickname)
    }
  }

  return names
}

/** 크롭 결과가 있을 때만 이름별 후보를 순서대로 비교하고 처음 일치한 캐릭터의 상세를 조회한다. */
export function createCharacterIdentifier(services: IdentificationServices) {
  return async (input: CharacterIdentificationInput): Promise<CharacterIdentification> => {
    if (input.nicknames.length > MAX_OCR_NAMES) {
      return { kind: 'invalid-input' }
    }
    const names = searchableNames(input.nicknames)
    const portrait = input.portrait
    if (portrait === null) {
      return { kind: 'portrait-unavailable' }
    }

    for (const nickname of names) {
      const candidates = await services.findCandidates(nickname)
      for (const candidate of candidates) {
        const identity = { serverId: candidate.serverId, characterId: candidate.characterId }
        const images = await services.loadPortraits(identity)
        if (images === null || images.length === 0) {
          return { kind: 'appearance-unavailable' }
        }
        let matches = false
        for (const image of images) {
          matches = await services.matchesPortrait({ portrait, candidate: image })
          if (matches) {
            break
          }
        }

        if (!matches) {
          continue
        }
        const details = await services.getDetails(identity)

        return { kind: 'matched', candidate, details, nickname }
      }
    }

    return { kind: 'unmatched' }
  }
}
