import type { CardCharacter } from '../../types/cards'

// 이미지 누락 시나리오의 데이터를 원본 캐릭터를 변경하지 않고 만든다.
export function getCharacterPreview(scenario: string, character: CardCharacter): CardCharacter {
  if (scenario !== 'missing') {
    return character
  }
  return {
    ...character,
    image: 'data:image/png;base64,AA==',
    equipment: character.equipment.map((item) => ({
      ...item,
      image: 'data:image/png;base64,AA==',
      enhancement: undefined,
      enchantment: undefined
    }))
  }
}
