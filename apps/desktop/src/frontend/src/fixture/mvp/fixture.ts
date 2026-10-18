import type { CardCharacter, EquipmentSlot } from '../../types/cards'
import characterImage from './assets/character.png'

const images = import.meta.glob<string>('./assets/item-*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})
const asset = (index: number): string => images[`./assets/item-${index}.png`]
const definitions = [
  ['SHOULDER', '머리어깨', 0],
  ['JACKET', '상의', 1],
  ['PANTS', '하의', 2],
  ['WAIST', '벨트', 3],
  ['SHOES', '신발', 4],
  ['WEAPON', '무기', 5],
  ['TITLE', '칭호', 6],
  ['WRIST', '팔찌', 7],
  ['AMULET', '목걸이', 8],
  ['SUPPORT', '보조장비', 9],
  ['RING', '반지', 10],
  ['EARRING', '귀걸이', 11],
  ['MAGIC_STON', '마법석', 12],
  ['AURA', '오라', 13],
  ['CREATURE', '크리쳐', 14]
] as const
const grades = ['종결', '준종결', '기타'] as const
const equipment: EquipmentSlot[] = definitions.map(([id, label, index]) => {
  const image = asset(index)
  let rarityColor: string
  if (index >= 7 && index <= 10) {
    rarityColor = '#50e3c2'
  } else if (['TITLE', 'AURA', 'CREATURE'].includes(id)) {
    rarityColor = '#b36bff'
  } else {
    rarityColor = '#ffb400'
  }
  let enhancement: string
  if (id === 'WEAPON') {
    enhancement = '+13'
  } else if (index > 6) {
    enhancement = '+11'
  } else {
    enhancement = '+10'
  }
  const enchantment = grades[index % grades.length]

  return { id, label, image, rarityColor, enhancement, enchantment }
})

export const previewCharacter: CardCharacter = {
  name: '미리보기검사',
  adventure: '샘플모험단',
  guild: '샘플길드',
  job: '眞 웨펀마스터',
  serverId: 'siroco',
  fame: 125850,
  equipmentScore: 414806,
  serverRank: 18240,
  image: characterImage,
  equipment,
  oath: equipment
    .filter((item) => !['TITLE', 'AURA', 'CREATURE'].includes(item.id))
    .map((item) => {
      const slot = { ...item }
      let imageIndex: number
      if (item.id === 'WEAPON') {
        imageIndex = 17
      } else if (['AMULET', 'RING', 'MAGIC_STON'].includes(item.id)) {
        imageIndex = 16
      } else {
        imageIndex = 15
      }
      const image = asset(imageIndex)
      slot.image = image
      const rarityColor = ['AMULET', 'RING', 'MAGIC_STON'].includes(item.id) ? '#50e3c2' : '#ffb400'
      slot.rarityColor = rarityColor

      return slot
    })
}

// 상위 유저 매칭 캔버스처럼 기본, 상위, 랭커 카드를 나란히 둔다. 단계를 나누는 기준이 아직 없어
// 단계, 순위, 숫자는 모두 합성 값이다.
export const tierPreviewCharacters: readonly (CardCharacter | null)[] = [
  previewCharacter,
  {
    ...previewCharacter,
    name: '미리보기상위',
    tier: 'top',
    fame: 131204,
    equipmentScore: 452310,
    serverRank: 4432
  },
  {
    ...previewCharacter,
    name: '미리보기랭커',
    tier: 'ranker',
    fame: 138960,
    equipmentScore: 498725,
    serverRank: 37
  },
  null
]
