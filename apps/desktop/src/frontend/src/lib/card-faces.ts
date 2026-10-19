import { MISSING_VALUE } from '../constants/cards'
import { investmentIds } from '../constants/equipment'
import type { CharacterCard } from '../types/cards'
import { type CardStatItem, type CardStatLabelLength, toCardStatItems } from './card-stats'

/** 희귀도 색 토큰 키. 컴포넌트가 이 키로 `rarity.*` 색을 고르고, 모르는 희귀도는 `unknown`이다. */
export type RarityTone =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'unique'
  | 'epic'
  | 'legendary'
  | 'chronicle'
  | 'primordial'
  | 'unknown'

/** 장비 점수 칸. 값이 있을 때만 숫자를 세어 올리고, 보조 기술에는 값의 성격이나 계산하지 못한 사유를 전한다. */
export type ScoreView = { value: number | null; description: string | undefined }

/** 서버 순위 칸. 화면에는 `#18240`이나 `-`, 보조 기술에는 수집 범위를 포함한 이름을 전한다. */
export type ServerRankView = { text: string; label: string }

export type CharacterFaceView = {
  stats: CardStatItem[]
  score: ScoreView
  serverRank: ServerRankView
}

/**
 * 부위 격자의 한 칸. `id`는 부위나 결정 자리이고, 장착하지 않은 칸은 `empty`, 장착했지만 희귀도를 모르는 칸은
 * `unknown`(카드 글자색)이다.
 */
export type RarityCellView = { id: string; tone: RarityTone | 'empty' }

/** 부위 격자의 한 묶음. `main`은 무기나 서약 본체처럼 넓고 높은 칸 하나다. */
export type RarityGroupView = { id: string; main: boolean; cells: RarityCellView[] }

export type RarityCountView = { label: string; count: string; tone: RarityTone }

/** 세트와 서약 섹션의 공통 머리. 값이 없으면 `missing`이고 이름 자리에 없다는 안내를 둔다. */
export type SummaryView = {
  missing: boolean
  name: string
  tone: RarityTone
  imageUrl: string | undefined
  imageLabel: string
  pointLabel: string
  point: string
  groups: RarityGroupView[]
  counts: RarityCountView[]
}

/** 묵언의 진의 한 칸. 접근 가능한 이름은 `N단계 <옵션명>`이고 빈 칸은 `N단계 비어 있음`이다. */
export type UpgradeCellView = { filled: boolean; label: string }

export type EquipmentFaceView = {
  set: SummaryView
  oath: SummaryView & { upgrades: UpgradeCellView[][] }
}

/** 기타 면 12행의 강화나 증폭 칸. 강화는 `game.enhance`, 증폭은 `game.amplify` 색이다. */
export type ReinforceView = { text: string; tone: 'enhance' | 'amplify' | 'missing'; label: string }

type EnchantGrade = NonNullable<
  NonNullable<CharacterCard['investment'][number]['enchant']>['grade']
>

/** 기타 면 12행의 마법부여 칸. 등급이 있으면 3점 중 `filled`개를 등급 색으로 칠하고 없으면 `-`다. */
export type EnchantView =
  | { grade: EnchantGrade; filled: number; label: string }
  | { grade: null; text: string; label: string }

/**
 * 기타 면 12행의 한 줄. 아이콘 칸과 아이템 이름은 같은 희귀도 색(`itemTone`)을 쓰고, 아이콘은 장식이라 부위와
 * 이름은 `itemLabel`로 보조 기술에 전한다.
 */
export type InvestmentRowView = {
  slotId: string
  itemName: string
  itemLabel: string
  itemTone: RarityTone | 'missing'
  imageUrl: string | undefined
  reinforce: ReinforceView
  enchant: EnchantView
}

const ITEM_IMAGE_ORIGIN = 'https://img-api.neople.co.kr'
// 캐릭터 이미지 식별자와 같은 문자 범위만 고정 origin URL에 넣는다.
const ITEM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/
const integer = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

const rarityTones: Readonly<Record<string, RarityTone>> = {
  커먼: 'common',
  언커먼: 'uncommon',
  레어: 'rare',
  유니크: 'unique',
  에픽: 'epic',
  레전더리: 'legendary',
  크로니클: 'chronicle',
  태초: 'primordial'
}

// 점수 엔진이 건너뛴 사유 종류. 엔진의 원문 메시지는 개발용이라 화면과 보조 기술에 쓰지 않는다.
const skippedReasons: Readonly<Record<string, string>> = {
  input_gate: '입력값이 게임 스탯과 다름',
  resolution: '아이템을 판별하지 못함',
  unresolved: '장비 정보 부족',
  exception: '계산 오류'
}

const SCORE_NOTE = 'DFragon 계산값이라 게임 장비 점수와 조금 다를 수 있습니다.'

/** 세트 격자의 부위 묶음. 무기 하나 뒤에 방어구 다섯, 장신구 셋, 특수 장비 셋을 캔버스 순서로 둔다. */
export const setSlotGroups = [
  { id: 'armor', slots: ['SHOULDER', 'JACKET', 'PANTS', 'WAIST', 'SHOES'] },
  { id: 'accessory', slots: ['WRIST', 'AMULET', 'RING'] },
  { id: 'special', slots: ['SUPPORT', 'MAGIC_STON', 'EARRING'] }
] as const

/** 서약 격자의 결정 묶음. 서약 본체 뒤에 결정 0~2번, 3~10번을 둔다. */
export const crystalSlotGroups = [
  { id: 'crystal-front', slots: [0, 1, 2] },
  { id: 'crystal-back', slots: [3, 4, 5, 6, 7, 8, 9, 10] }
] as const

// 묵언의 진의 9칸을 캔버스처럼 앞 넷, 뒤 다섯으로 나눈다.
const UPGRADE_STEPS = 9
const UPGRADE_FIRST_GROUP = 4

/** 12부위의 화면 이름. 카드 값의 부위 이름이 없을 때 쓴다. */
export const slotNames: Readonly<Record<string, string>> = {
  WEAPON: '무기',
  JACKET: '상의',
  SHOULDER: '머리어깨',
  PANTS: '하의',
  WAIST: '벨트',
  SHOES: '신발',
  AMULET: '목걸이',
  WRIST: '팔찌',
  RING: '반지',
  SUPPORT: '보조장비',
  MAGIC_STON: '마법석',
  EARRING: '귀걸이'
}

const gradeFill = { 종결: 3, 준종결: 2, 기타: 1 } as const satisfies Record<EnchantGrade, number>

/** Neople 희귀도 이름을 색 토큰 키로 바꾼다. `유니크 Ⅱ`처럼 단계가 붙은 이름은 앞 단어로 고른다. */
export function toRarityTone(rarity: string | null | undefined): RarityTone {
  if (rarity == null) {
    return 'unknown'
  }

  const name = rarity.split(' ')[0]
  if (!Object.hasOwn(rarityTones, name)) {
    return 'unknown'
  }

  return rarityTones[name]
}

/** 검증한 아이템 식별자로 고정 origin의 아이템 이미지 URL을 만든다. 쓸 수 없는 식별자는 대체 표시로 둔다. */
export function itemImageUrl(itemId: string | null | undefined): string | undefined {
  if (itemId == null || !ITEM_ID_PATTERN.test(itemId)) {
    return undefined
  }

  return `${ITEM_IMAGE_ORIGIN}/df/items/${itemId}`
}

/** 아이템 그림 주소. 합성 미리보기가 그 itemId의 로컬 그림을 주었으면 그것을, 아니면 고정 origin URL을 쓴다. */
export function toItemImage(
  itemId: string | null | undefined,
  itemImages: Readonly<Record<string, string>> | undefined
): string | undefined {
  if (itemId != null && itemImages !== undefined && Object.hasOwn(itemImages, itemId)) {
    return itemImages[itemId]
  }

  return itemImageUrl(itemId)
}

function formatPoint(point: number | null | undefined): string {
  if (point == null) {
    return MISSING_VALUE
  }

  return integer.format(point)
}

function toScoreView(score: CharacterCard['score'] | undefined): ScoreView {
  if (score == null) {
    return { value: null, description: undefined }
  }

  if (score.value != null) {
    return { value: score.value, description: SCORE_NOTE }
  }

  if (score.skipped == null) {
    return { value: null, description: undefined }
  }
  const { kind } = score.skipped
  const reason = Object.hasOwn(skippedReasons, kind) ? skippedReasons[kind] : '계산 제외'

  return { value: null, description: `계산하지 못함, ${reason}` }
}

function toServerRankView(serverRank: CharacterCard['serverRank'] | undefined): ServerRankView {
  if (serverRank == null) {
    return { text: MISSING_VALUE, label: '서버 순위 없음' }
  }
  const { rank, total } = serverRank

  return {
    text: `#${rank}`,
    label: `서버 순위 ${rank}위, DFragon이 수집한 캐릭터 ${integer.format(total)}명 기준`
  }
}

/**
 * 캐릭터 면과 공대 카드에 보일 스탯 한 줄, 장비 점수, 서버 순위를 정한다. 버퍼의 버프 점수도 장비 점수 칸에
 * 둔다. 계산하지 못한 점수는 값 없이 사유 종류를, 서버 순위는 수집 범위의 순위라는 뜻을 보조 기술에 전한다.
 */
export function toCharacterFace(
  card: CharacterCard | null | undefined,
  labelLength: CardStatLabelLength
): CharacterFaceView {
  return {
    stats: toCardStatItems(card?.stats, labelLength),
    score: toScoreView(card?.score),
    serverRank: toServerRankView(card?.serverRank)
  }
}

function toRarityCounts(counts: readonly { rarity: string; count: number }[]): RarityCountView[] {
  return counts.map(({ rarity, count }) => ({
    label: rarity,
    count: integer.format(count),
    tone: toRarityTone(rarity)
  }))
}

// 자리별 희귀도로 격자 묶음을 만든다. 장착 정보가 없는 자리는 빈 칸, 희귀도가 null인 자리는 `unknown`이다.
function toRarityGroups<Slot>(
  groups: readonly { id: string; slots: readonly Slot[] }[],
  rarityBySlot: Map<Slot, string | null>,
  cellId: (slot: Slot) => string
): RarityGroupView[] {
  return groups.map(({ id, slots }) => ({
    id,
    main: false,
    cells: slots.map((slot): RarityCellView => {
      if (!rarityBySlot.has(slot)) {
        return { id: cellId(slot), tone: 'empty' }
      }

      return { id: cellId(slot), tone: toRarityTone(rarityBySlot.get(slot)) }
    })
  }))
}

function toSetView(
  card: CharacterCard | null | undefined,
  itemImages: Readonly<Record<string, string>> | undefined
): SummaryView {
  const weapon = card?.investment.find((row) => row.slotId === 'WEAPON')
  const weaponTone: RarityCellView['tone'] =
    weapon?.itemId == null ? 'empty' : toRarityTone(weapon.rarity)
  const weaponGroup: RarityGroupView = {
    id: 'weapon',
    main: true,
    cells: [{ id: 'WEAPON', tone: weaponTone }]
  }
  const set = card?.set ?? null
  if (set == null) {
    return {
      missing: true,
      name: '세트 정보 없음',
      tone: 'unknown',
      imageUrl: undefined,
      imageLabel: '세트',
      pointLabel: '세트 포인트',
      point: MISSING_VALUE,
      groups: [weaponGroup, ...toRarityGroups(setSlotGroups, new Map(), String)],
      counts: []
    }
  }
  const rarityBySlot = new Map(set.slots.map((slot) => [slot.slotId, slot.rarity]))

  return {
    missing: false,
    name: set.name,
    tone: toRarityTone(set.rarityName),
    imageUrl: toItemImage(set.imageItemId, itemImages),
    imageLabel: `${set.name} 대표 장비`,
    pointLabel: '세트 포인트',
    point: formatPoint(set.point?.current),
    groups: [weaponGroup, ...toRarityGroups(setSlotGroups, rarityBySlot, String)],
    counts: toRarityCounts(set.rarityCounts)
  }
}

function toUpgradeCells(
  upgrades: readonly { step: number; optionName: string }[]
): UpgradeCellView[][] {
  const optionByStep = new Map(upgrades.map((upgrade) => [upgrade.step, upgrade.optionName]))
  const cells = Array.from({ length: UPGRADE_STEPS }, (_, index): UpgradeCellView => {
    const step = index + 1
    const optionName = optionByStep.get(step)
    if (optionName == null) {
      return { filled: false, label: `${step}단계 비어 있음` }
    }

    return { filled: true, label: `${step}단계 ${optionName}` }
  })

  return [cells.slice(0, UPGRADE_FIRST_GROUP), cells.slice(UPGRADE_FIRST_GROUP)]
}

const crystalCellId = (slotNo: number): string => `crystal-${slotNo}`

function toOathView(
  card: CharacterCard | null | undefined,
  itemImages: Readonly<Record<string, string>> | undefined
): EquipmentFaceView['oath'] {
  const oath = card?.oath ?? null
  if (oath == null) {
    return {
      missing: true,
      name: '서약 정보 없음',
      tone: 'unknown',
      imageUrl: undefined,
      imageLabel: '서약',
      pointLabel: '서약 포인트',
      point: MISSING_VALUE,
      groups: [
        { id: 'oath', main: true, cells: [{ id: 'oath', tone: 'empty' }] },
        ...toRarityGroups(crystalSlotGroups, new Map(), crystalCellId)
      ],
      counts: [],
      upgrades: toUpgradeCells([])
    }
  }
  const rarityBySlot = new Map(oath.crystals.map((crystal) => [crystal.slotNo, crystal.rarity]))
  // 캔버스의 서약 제목은 세트 옵션 이름(`여우 : 초월`)이고, 없으면 세트 이름, 서약 아이템 이름 순서로 쓴다.
  const name = oath.optionName ?? oath.setName ?? oath.name
  const bodyTone = toRarityTone(oath.rarity)

  return {
    missing: false,
    name,
    tone: bodyTone,
    imageUrl: toItemImage(oath.itemId, itemImages),
    imageLabel: oath.name,
    pointLabel: '서약 포인트',
    point: formatPoint(oath.setPoint?.current),
    groups: [
      { id: 'oath', main: true, cells: [{ id: 'oath', tone: bodyTone }] },
      ...toRarityGroups(crystalSlotGroups, rarityBySlot, crystalCellId)
    ],
    counts: toRarityCounts(oath.rarityCounts),
    upgrades: toUpgradeCells(oath.upgrades)
  }
}

/**
 * 장비 면의 세트와 서약 섹션을 정한다. 세트는 그림, 이름, 세트 포인트, 무기와 세트 부위의 희귀도 격자, 희귀도
 * 개수를, 서약은 그림, 이름, 묵언의 진의 9칸, 서약 포인트, 본체와 결정의 희귀도 격자, 희귀도 개수를 보인다.
 * `itemImages`는 합성 미리보기의 로컬 그림이고, 없으면 그림은 itemId로 만든 고정 origin URL이다.
 */
export function toEquipmentFace(
  card: CharacterCard | null | undefined,
  itemImages?: Readonly<Record<string, string>>
): EquipmentFaceView {
  return { set: toSetView(card, itemImages), oath: toOathView(card, itemImages) }
}

/** 강화나 증폭 칸. 강화와 증폭을 색과 보조 기술 이름으로 나누고, 값이 없으면 `-`다. */
export function toReinforceView(
  row: CharacterCard['investment'][number] | undefined
): ReinforceView {
  const reinforce = row?.reinforce ?? null
  if (reinforce == null) {
    return { text: MISSING_VALUE, tone: 'missing', label: '강화 정보 없음' }
  }

  if (reinforce.kind === 'amplify') {
    return { text: `+${reinforce.value}`, tone: 'amplify', label: `증폭 ${reinforce.value}` }
  }

  return { text: `+${reinforce.value}`, tone: 'enhance', label: `강화 ${reinforce.value}` }
}

// 판정 기준표에 없는 마법부여는 미평가이며 `기타`로 바꾸지 않는다.
function toEnchantView(row: CharacterCard['investment'][number] | undefined): EnchantView {
  const enchant = row?.enchant ?? null
  if (enchant == null) {
    return { grade: null, text: MISSING_VALUE, label: '마법부여 없음' }
  }

  if (enchant.grade == null) {
    return { grade: null, text: MISSING_VALUE, label: '마법부여 미평가' }
  }

  return {
    grade: enchant.grade,
    filled: gradeFill[enchant.grade],
    label: `마법부여 ${enchant.grade}`
  }
}

/**
 * 기타 면의 12행을 무기, 상의, 머리어깨 순서로 정한다. 행마다 아이템 이름과 희귀도, 강화나 증폭 수치, 마법부여
 * 등급과 아이콘을 두고, 장착하지 않은 부위나 카드가 없을 때는 부위 이름에 `-` 값과 빈 아이콘 칸을 둔다.
 * `itemImages`는 합성 미리보기의 로컬 그림이고, 없으면 아이콘은 itemId로 만든 고정 origin URL이다.
 */
export function toInvestmentRows(
  card: CharacterCard | null | undefined,
  itemImages?: Readonly<Record<string, string>>
): InvestmentRowView[] {
  return investmentIds.map((slotId) => {
    const row = card?.investment.find((item) => item.slotId === slotId)
    const slotName = row?.slotName ?? slotNames[slotId]
    if (row?.itemName == null) {
      return {
        slotId,
        itemName: MISSING_VALUE,
        itemLabel: `${slotName}, 장착 정보 없음`,
        itemTone: 'missing',
        imageUrl: undefined,
        reinforce: toReinforceView(row),
        enchant: toEnchantView(row)
      }
    }

    return {
      slotId,
      itemName: row.itemName,
      itemLabel: `${slotName}, ${row.itemName}`,
      itemTone: toRarityTone(row.rarity),
      imageUrl: toItemImage(row.itemId, itemImages),
      reinforce: toReinforceView(row),
      enchant: toEnchantView(row)
    }
  })
}
