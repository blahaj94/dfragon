import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import type {
  CharacterCandidatesHttp,
  CharacterDetailsHttp,
  CharacterImageHttp
} from './character-http'
import { SearchHttpFailure } from './http'
import type { StayImageSource } from './stay-images'
import {
  runSearchOperation,
  type SearchOperationContext,
  type SearchOperationOutcome
} from './operation'

const MAX_OCR_NAMES = 2
const MAX_NAME_CODE_POINTS = 12

export type PortraitMatcher = (input: {
  portrait: CharacterPortrait
  candidate: CharacterImage
  signal: AbortSignal
}) => Promise<boolean>

type IdentificationDependencies = {
  candidates: CharacterCandidatesHttp
  image: CharacterImageHttp | StayImageSource
  details: CharacterDetailsHttp
  matchesPortrait: PortraitMatcher
}

export type CharacterIdentification =
  | { kind: 'portrait-unavailable' }
  | { kind: 'unmatched' }
  | {
      kind: 'matched'
      candidate: CharacterCandidate
      details: CharacterDetails
      nickname: string
    }

export type CharacterIdentificationInput = SearchOperationContext & {
  nicknames: readonly string[]
  portrait: CharacterPortrait | null
}

/** 순위는 유지하고 검색할 수 없는 빈 OCR 후보와 같은 이름의 반복만 제외한다. */
function searchableNames(nicknames: readonly string[]): string[] {
  if (nicknames.length > MAX_OCR_NAMES) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }
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
export function createCharacterIdentifier(dependencies: IdentificationDependencies) {
  return async (
    input: CharacterIdentificationInput
  ): Promise<SearchOperationOutcome<CharacterIdentification>> => {
    return runSearchOperation(
      input,
      async (signal, assertActive): Promise<CharacterIdentification> => {
        const names = searchableNames(input.nicknames)
        const portrait = input.portrait
        if (portrait === null) {
          return { kind: 'portrait-unavailable' }
        }

        for (const nickname of names) {
          assertActive()
          const candidates = await dependencies.candidates({ nickname, signal })
          assertActive()
          for (const candidate of candidates) {
            assertActive()
            const identity = { serverId: candidate.serverId, characterId: candidate.characterId }
            const source = await dependencies.image({ ...identity, signal })
            assertActive()
            let images: readonly CharacterImage[]
            if ('kind' in source) {
              if (source.kind === 'unavailable' || source.images.length === 0) {
                throw new SearchHttpFailure('SEARCH_APPEARANCE_UNAVAILABLE')
              }
              images = source.images
            } else {
              images = [source]
            }
            let matches = false
            for (const image of images) {
              assertActive()
              try {
                matches = await dependencies.matchesPortrait({ portrait, candidate: image, signal })
              } catch {
                assertActive()
                // 비교 입력이나 연산 한도 문제를 불일치로 숨겨 다음 후보를 선택하지 않는다.
                throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
              }
              assertActive()
              if (matches) {
                break
              }
            }

            if (!matches) {
              continue
            }
            const details = await dependencies.details({ ...identity, signal })
            assertActive()

            return { kind: 'matched', candidate, details, nickname }
          }
        }

        return { kind: 'unmatched' }
      }
    )
  }
}
