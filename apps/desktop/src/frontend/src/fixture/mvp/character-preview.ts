import type { CardCharacter } from '../../types/cards'

const BROKEN_IMAGE = 'data:image/png;base64,AA=='

export function getCharacterPreview(scenario: string, character: CardCharacter): CardCharacter {
  if (scenario !== 'missing') {
    return character
  }

  return { ...character, image: BROKEN_IMAGE }
}
