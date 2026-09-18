import type { CardCharacter, EquipmentSlot } from '../cards/types'
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
const equipment: EquipmentSlot[] = definitions.map(([id, label, index]) => ({
  id,
  label,
  image: asset(index),
  rarityColor:
    index >= 7 && index <= 10
      ? '#50e3c2'
      : ['TITLE', 'AURA', 'CREATURE'].includes(id)
        ? '#b36bff'
        : '#ffb400',
  enhancement: id === 'WEAPON' ? '+13' : index > 6 ? '+11' : '+10',
  enchantment: grades[index % grades.length]
}))

export const previewCharacter: CardCharacter = {
  name: '미리보기검사',
  adventure: '샘플모험단',
  job: '眞 웨펀마스터',
  serverId: 'siroco',
  fame: 125850,
  equipmentScore: 414806,
  image: characterImage,
  equipment,
  oath: equipment
    .filter((item) => !['TITLE', 'AURA', 'CREATURE'].includes(item.id))
    .map((item) => ({
      ...item,
      image: asset(
        item.id === 'WEAPON' ? 17 : ['AMULET', 'RING', 'MAGIC_STON'].includes(item.id) ? 16 : 15
      ),
      rarityColor: ['AMULET', 'RING', 'MAGIC_STON'].includes(item.id) ? '#50e3c2' : '#ffb400'
    }))
}
