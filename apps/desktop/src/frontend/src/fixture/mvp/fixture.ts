import { bufferCard, dealerCard } from '../../testing/fixtures/character-cards'
import type { CardCharacter, CardStats, CharacterCard, EquipmentSlot } from '../../types/cards'
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

  return { id, label, image, rarityColor }
})

// 딜러 카드 기타 면 12부위의 로컬 아이콘 번호. 상의는 세트 대표 장비와 같은 아이템이다.
const dealerInvestmentIcons: Readonly<Record<string, number>> = {
  WEAPON: 22,
  JACKET: 18,
  SHOULDER: 23,
  PANTS: 24,
  WAIST: 25,
  SHOES: 26,
  AMULET: 27,
  WRIST: 28,
  RING: 29,
  SUPPORT: 30,
  MAGIC_STON: 31,
  EARRING: 32
}

// 카드 값의 세트 대표 장비, 서약, 딜러 12부위 itemId에 대응하는 로컬 아이콘. 제품 CSP는 원격 그림을 허용하지만
// 합성 미리보기는 로컬 자산만 쓰므로 itemId별 그림을 주입한다.
const itemImages: Readonly<Record<string, string>> = Object.fromEntries(
  [
    [dealerCard.set?.imageItemId, asset(18)],
    [bufferCard.set?.imageItemId, asset(19)],
    [dealerCard.oath?.itemId, asset(20)],
    [bufferCard.oath?.itemId, asset(21)],
    ...dealerCard.investment.map((row) => [row.itemId, asset(dealerInvestmentIcons[row.slotId])])
  ].filter((entry): entry is [string, string] => entry[0] != null)
)

export const previewCharacter: CardCharacter = {
  name: '미리보기검사',
  adventure: '샘플모험단',
  guild: '샘플길드',
  job: '眞 웨펀마스터',
  serverId: 'siroco',
  fame: 125850,
  card: dealerCard,
  image: characterImage,
  itemImages,
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

// 카드 면 보드처럼 버퍼 카드의 캐릭터 면을 딜러 카드 옆에 둔다.
export const bufferPreviewCharacter: CardCharacter = {
  ...previewCharacter,
  name: '미리보기인챈',
  job: '眞 인챈트리스',
  fame: 129770,
  card: bufferCard
}

// 세 면 비교. 딜러 카드 셋이 캐릭터, 장비, 기타 면을, 마지막 버퍼 카드가 캐릭터 면을 처음에 보인다.
export const facePreviewCharacters: readonly (CardCharacter | null)[] = [
  previewCharacter,
  previewCharacter,
  previewCharacter,
  bufferPreviewCharacter
]

// 합성 카드 값. 스탯, 장비 점수, 서버 순위만 바꾸고 세트, 서약, 12부위는 바탕 카드를 그대로 쓴다.
function previewCard({
  base = dealerCard,
  stats,
  score,
  rank
}: {
  base?: CharacterCard
  stats: CardStats | null
  score: number | null
  rank: number | null
}): CharacterCard {
  const role = stats?.role ?? null
  const scoreValue = base.score == null ? null : { ...base.score, value: score }
  const serverRank = rank == null || base.serverRank == null ? null : { ...base.serverRank, rank }

  return { ...base, role, stats, score: scoreValue, serverRank }
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
    card: previewCard({ stats: dealerCard.stats, score: 452310, rank: 4432 })
  },
  {
    ...previewCharacter,
    name: '미리보기랭커',
    tier: 'ranker',
    fame: 138960,
    card: previewCard({ stats: dealerCard.stats, score: 498725, rank: 37 })
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
  ['샘플닌자', '眞 쿠노이치', 119900, null, undefined]
] as const

// 공대 카드 스탯 한 줄의 합성 값. 딜러는 공격력 증가, 증폭, 크리티컬, 스위칭 레벨, 버퍼는 마을 지능과 버프
// 수치, 스위칭 레벨이다.
function dealerStats(seed: number): CardStats {
  return {
    role: 'dealer',
    attackIncrease: 107_000_000 + seed * 3_000_000,
    amplification: 2760 + seed * 23,
    critical: 92.5 + (seed % 3) * 2.5,
    switchingLevel: 18 + (seed % 3)
  }
}

function bufferStats(seed: number): CardStats {
  return {
    role: 'buffer',
    townIntelligence: 31_420 + seed * 120,
    buff30: 1_284_000 + seed * 10_000,
    buff50: 3_926_000 + seed * 30_000,
    switchingLevel: 18 + (seed % 3)
  }
}

const bufferJobs = new Set(['眞 크루세이더', '眞 인챈트리스', '眞 뮤즈'])

// 공대 12인 화면의 합성 공대원. 세 파티 네 명씩이고 마지막 자리는 비어 있다. 이름, 단계, 순위, 숫자는
// 모두 합성 값이다. 순위가 없는 공대원은 main이 카드 값을 넘기지 않은 경우처럼 길드, 장비 점수와 스탯도
// 없어 `-`로 보인다.
export const raidPreviewCharacters: readonly (CardCharacter | null)[] = [
  ...raidMembers.map(([name, job, fame, serverRank, tier], index) => {
    const buffer = bufferJobs.has(job)
    const card =
      serverRank === null
        ? null
        : previewCard({
            base: buffer ? bufferCard : dealerCard,
            stats: buffer ? bufferStats(index) : dealerStats(index),
            score: 414806 - index * 4210,
            rank: serverRank
          })

    return {
      ...previewCharacter,
      name,
      job,
      fame,
      tier,
      card,
      ...(serverRank === null && { guild: null })
    }
  }),
  null
]

function withAdventure(character: CardCharacter, name: string, adventure: string): CardCharacter {
  return { ...character, name, adventure }
}

// 공대원에게 자리 번호별 합성 모험단을 준다. 빈 자리는 vacant로 채운다.
function withSampleAdventure(
  member: CardCharacter | null,
  index: number,
  vacant: CardCharacter | null
): CardCharacter | null {
  if (member === null) {
    return vacant
  }

  return { ...member, adventure: `샘플모험단 ${index + 1}` }
}

const snapshotMembers = {
  first: withAdventure(previewCharacter, '미리보기검사', '첫째모험단'),
  second: withAdventure(bufferPreviewCharacter, '미리보기인챈', '둘째모험단'),
  third: withAdventure(previewCharacter, '미리보기소울', '셋째모험단'),
  thirdOther: withAdventure(previewCharacter, '미리보기부캐', '셋째모험단'),
  fourth: withAdventure(previewCharacter, '미리보기퇴마', '넷째모험단'),
  stranger: withAdventure(previewCharacter, '미리보기외부', '낯선모험단')
}

// 모험단 순번 스냅샷 미리보기의 파티. 첫 회차에서 스냅샷을 켠 뒤 캡처 버튼을 누르면 다음 회차가 되어 1번과
// 2번의 자리가 바뀌고, 3번은 같은 모험단의 다른 캐릭터가 들어오고, 4번은 스냅샷에 없는 모험단이 들어온다.
// 캡처를 한 번 더 누르면 처음 회차로 돌아온다. 이름과 모험단은 모두 합성 값이다.
export const snapshotPreviewPartyRounds: readonly (readonly CardCharacter[])[] = [
  [snapshotMembers.first, snapshotMembers.second, snapshotMembers.third, snapshotMembers.fourth],
  [
    snapshotMembers.second,
    snapshotMembers.first,
    snapshotMembers.thirdOther,
    snapshotMembers.stranger
  ]
]

// 모험단 순번 스냅샷 미리보기의 공대. 공대원마다 다른 모험단이고 빈 자리가 하나 있다. 캡처 버튼을 누르면
// 다음 회차가 되어 빈 자리에 스냅샷에 없는 모험단의 공대원이 들어온다. 캡처를 한 번 더 누르면 처음 회차로
// 돌아온다.
export const snapshotPreviewRaidRounds: readonly (readonly (CardCharacter | null)[])[] = [
  raidPreviewCharacters.map((member, index) => withSampleAdventure(member, index, null)),
  raidPreviewCharacters.map((member, index) =>
    withSampleAdventure(member, index, snapshotMembers.stranger)
  )
]
