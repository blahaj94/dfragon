import type { CardCharacter } from '../../types/cards'

const BROKEN_IMAGE = 'data:image/png;base64,AA=='

// 이미지 누락 시나리오의 데이터를 원본 캐릭터를 변경하지 않고 만든다. 캐릭터 그림을 깨뜨린다.
export function getCharacterPreview(scenario: string, character: CardCharacter): CardCharacter {
  if (scenario !== 'missing') {
    return character
  }

  return { ...character, image: BROKEN_IMAGE }
}
