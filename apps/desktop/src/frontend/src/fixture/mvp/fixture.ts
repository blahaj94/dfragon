import type { CharacterChoice } from '../../../../preload/common/types/search'
import { bufferCard, dealerCard } from '../../testing/fixtures/character-cards'
import type { CardCharacter, CharacterCard } from '../../types/cards'
import characterImage from './assets/character.png'

export const previewCharacter: CardCharacter = {
  name: '미리보기검사',
  adventure: '샘플모험단',
  guild: '샘플길드',
  job: '眞 웨펀마스터',
  serverId: 'siroco',
  fame: 125850,
  card: dealerCard,
  image: characterImage
}

// 버퍼 카드를 딜러 카드 옆에 둔다.
export const bufferPreviewCharacter: CardCharacter = {
  ...previewCharacter,
  name: '미리보기인챈',
  job: '眞 인챈트리스',
  fame: 129770,
  card: bufferCard
}

// 합성 카드 값. 역할과 장비 점수만 바꾼다.
function previewCard({
  base = dealerCard,
  score
}: {
  base?: CharacterCard
  score: number | null
}): CharacterCard {
  const scoreValue = base.score == null ? null : { ...base.score, value: score }

  return { ...base, score: scoreValue }
}

// 상위 유저 매칭 캔버스처럼 기본, 상위, 랭커 카드를 나란히 둔다. 단계를 나누는 기준이 아직 없어
// 단계와 숫자는 모두 합성 값이다.
export const tierPreviewCharacters: readonly (CardCharacter | null)[] = [
  previewCharacter,
  {
    ...previewCharacter,
    name: '미리보기상위',
    tier: 'top',
    fame: 131204,
    card: previewCard({ score: 452310 })
  },
  {
    ...previewCharacter,
    name: '미리보기랭커',
    tier: 'ranker',
    fame: 138960,
    card: previewCard({ score: 498725 })
  },
  null
]

// 점수 라벨과 색 비교. 딜러(장비 점수, 파랑), 버퍼(버프 점수, 초록), 역할을 모르는 카드(장비 점수, 기본색),
// 상위 단계 버퍼(버프 점수, 단계 색)를 나란히 둔다. 이름, 단계, 숫자는 모두 합성 값이다.
export const rolePreviewCharacters: readonly (CardCharacter | null)[] = [
  previewCharacter,
  bufferPreviewCharacter,
  {
    ...previewCharacter,
    name: '미리보기역할모름',
    card: { ...previewCard({ score: 372904 }), role: null }
  },
  {
    ...bufferPreviewCharacter,
    name: '미리보기상위인챈',
    tier: 'top',
    fame: 131204,
    card: previewCard({ base: bufferCard, score: 452310 })
  }
]

// 공대원마다 이름, 직업, 명성, 카드 값 여부, 단계다.
const raidMembers = [
  ['미리보기검사', '眞 웨펀마스터', 125850, true, undefined],
  ['샘플크루', '眞 크루세이더', 131204, true, 'top'],
  ['샘플마도', '眞 엘레멘탈마스터', 118420, true, undefined],
  ['샘플거너', '眞 레인저', 121300, true, undefined],
  ['샘플격투', '眞 스트라이커', 138960, true, 'ranker'],
  ['샘플인챈', '眞 인챈트리스', 129770, true, undefined],
  ['샘플소울', '眞 소울브링어', 116080, true, undefined],
  ['샘플나이트', '眞 엘븐나이트', 133410, true, 'top'],
  ['샘플퇴마', '眞 퇴마사', 112640, true, undefined],
  ['샘플뮤즈', '眞 뮤즈', 127310, true, undefined],
  ['샘플닌자', '眞 쿠노이치', 119900, false, undefined]
] as const

const bufferJobs = new Set(['眞 크루세이더', '眞 인챈트리스', '眞 뮤즈'])

// 공대 12인 화면의 합성 공대원. 세 파티 네 명씩이고 마지막 자리는 비어 있다. 이름, 단계, 숫자는 모두
// 합성 값이다. 카드 값이 없는 공대원은 main이 카드 값을 넘기지 않은 경우처럼 길드와 장비 점수도 없어 `-`로
// 보인다.
export const raidPreviewCharacters: readonly (CardCharacter | null)[] = [
  ...raidMembers.map(([name, job, fame, hasCard, tier], index) => {
    const base = bufferJobs.has(job) ? bufferCard : dealerCard
    const card = hasCard ? previewCard({ base, score: 414806 - index * 4210 }) : null

    return {
      ...previewCharacter,
      name,
      job,
      fame,
      tier,
      card,
      ...(!hasCard && { guild: null })
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

// 후보 줄 미리보기. 얼굴 창은 합성 좌표이며, 이미지는 미리보기에서 받지 못하면 빈 칸으로 보인다.
const previewFace = { x: 150, y: 50, width: 40, height: 40 }
function previewChoice(
  serverId: string,
  serverName: string,
  adventureName: string | null,
  face: CharacterChoice['face'] = previewFace
): CharacterChoice {
  return {
    characterId: `preview-${serverId}`,
    characterName: '미리보기검사',
    serverId,
    serverName,
    fame: null,
    adventureName,
    face
  }
}

/** 슬롯마다 후보 넷, 둘, 얼굴 없는 여덟, 없음 */
export const candidatePreviewChoices: readonly (readonly CharacterChoice[] | null)[] = [
  [
    previewChoice('siroco', '시로코', '샘플모험단'),
    previewChoice('cain', '카인', '달빛아래늑대무리'),
    previewChoice('hilder', '힐더', '새벽늑대'),
    previewChoice('bakal', '바칼', null)
  ],
  [previewChoice('siroco', '시로코', '샘플모험단'), previewChoice('cain', '카인', '흰늑대')],
  [
    previewChoice('bakal', '바칼', '흰늑대', null),
    previewChoice('cain', '카인', '달빛아래늑대무리', null),
    previewChoice('siroco', '시로코', '샘플모험단'),
    previewChoice('hilder', '힐더', null, null),
    previewChoice('anton', '안톤', '늑대굴파수꾼', null),
    previewChoice('prey', '프레이', '별빛사냥꾼', null),
    previewChoice('casillas', '카시야스', null, null),
    previewChoice('diregie', '디레지에', '푸른송곳니', null)
  ],
  null
]
