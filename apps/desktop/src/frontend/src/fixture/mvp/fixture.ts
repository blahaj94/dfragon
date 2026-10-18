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

const raidMembers = [
  ['미리보기검사', '眞 웨펀마스터', 125850, 18240, undefined],
  ['샘플크루', '眞 크루세이더', 131204, 4432, 'top'],
  ['샘플마도', '眞 엘레멘탈마스터', 118420, 25110, undefined],
  ['샘플거너', '眞 레인저', 121300, 21876, undefined],
  ['샘플격투', '眞 스트라이커', 138960, 37, 'ranker'],
  ['샘플인챈', '眞 인챈트리스', 129770, 6120, undefined],
  ['샘플소울', '眞 소울브링어', 116080, 28903, undefined],
  ['샘플나이트', '眞 엘븐나이트', 133410, 2950, 'top'],
  ['샘플퇴마', '眞 퇴마사', 112640, 31544, undefined],
  ['샘플뮤즈', '眞 뮤즈', 127310, 9821, undefined],
  ['샘플닌자', '眞 쿠노이치', 119900, 23310, undefined]
] as const

// 공대 12인 화면의 합성 공대원. 세 파티 네 명씩이고 마지막 자리는 비어 있다. 공대 데이터와
// 단계 기준이 아직 없어 이름, 단계, 순위, 숫자는 모두 합성 값이다.
export const raidPreviewCharacters: readonly (CardCharacter | null)[] = [
  ...raidMembers.map(([name, job, fame, serverRank, tier]) => ({
    ...previewCharacter,
    name,
    job,
    fame,
    serverRank,
    tier
  })),
  null
]
