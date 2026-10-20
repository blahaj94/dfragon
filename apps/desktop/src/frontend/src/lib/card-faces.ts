import { MISSING_VALUE } from '../constants/cards'
import { investmentIds } from '../constants/equipment'
import type { CharacterCard } from '../types/cards'
import { type CardStatItem, type CardStatLabelLength, toCardStatItems } from './card-stats'
import { type ItemPicture, oathIcon, setIcon } from './equipment-icons'
import { type OathUpgradeKind, oathUpgradeKind, oathUpgradeKindLabels } from './oath-upgrades'

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

/**
 * 점수 칸. 라벨은 역할을 따라 딜러와 역할을 모르는 카드는 `장비 점수`, 버퍼는 `버프 점수`이고, `tone`은 값이
 * 있을 때 숫자에 칠할 역할 색(역할을 모르면 null)이다. 값이 있을 때만 숫자를 세어 올리고, 보조 기술에는 값의
 * 성격이나 계산하지 못한 사유를 전한다. 엔진이 정확한 점수 대신 근사값을 냈으면 `approximate`이고 값은
 * `formatApproximateScore`로 `≈`를 붙여 보인다.
 */
export type ScoreView = {
  label: '장비 점수' | '버프 점수'
  tone: 'dealer' | 'buffer' | null
  value: number | null
  approximate: boolean
  description: string | undefined
}

/** 서버 순위 칸. 화면에는 `#18240`이나 `-`, 보조 기술에는 수집 범위를 포함한 이름을 전한다. */
export type ServerRankView = { text: string; label: string }

export type CharacterFaceView = {
  stats: CardStatItem[]
  score: ScoreView
  serverRank: ServerRankView
}

/**
 * 부위 격자의 한 칸. `id`는 부위나 결정 자리이고, 장착하지 않은 칸은 `empty`, 장착했지만 희귀도를 모르는 칸은
 * `unknown`(카드 글자색)이다. `exclusive`는 유일 장비 칸이라 빛을 더한다.
 */
export type RarityCellView = { id: string; tone: RarityTone | 'empty'; exclusive: boolean }

/** 부위 격자의 한 묶음. `main`은 무기나 서약 본체처럼 넓고 높은 칸 하나다. */
export type RarityGroupView = { id: string; main: boolean; cells: RarityCellView[] }

/** 희귀도 개수 칩. 세트의 `유일` 칩은 유일 장비 칸과 같은 빛을 숫자에 더한다(`exclusive`). */
export type RarityCountView = { label: string; count: string; tone: RarityTone; exclusive: boolean }

/**
 * 세트와 서약 섹션의 공통 머리. 값이 없으면 `missing`이고 이름 자리에 없다는 안내를 둔다. 그림은 115 세트면
 * 세트 아이콘, 서약이면 서약 아이콘이고 번들한 아이콘이 없으면 네오플 아이템 그림이다.
 */
export type SummaryView = {
  missing: boolean
  name: string
  tone: RarityTone
  image: ItemPicture | undefined
  imageLabel: string
  pointLabel: string
  point: string
  groups: RarityGroupView[]
  counts: RarityCountView[]
}

/**
 * 묵언의 진의 한 칸. 연 칸은 옵션 종류(`kind`) 색이고 이름은 `N단계 · <종류> (<옵션명>)`이다. 종류를 모르는
 * 옵션은 `other`(카드 글자색)에 `N단계 · <옵션명>`, 빈 칸은 `empty`에 `N단계 비어 있음`이다.
 */
export type UpgradeCellView = { kind: OathUpgradeKind | 'other' | 'empty'; label: string }

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
 * 이름은 `itemLabel`로 보조 기술에 전한다. 유일 장비(`exclusive`)는 아이콘 칸과 이름에 빛을 더하고 `itemLabel`
 * 끝에 `유일 장비`를 붙인다.
 */
export type InvestmentRowView = {
  slotId: string
  itemName: string
  itemLabel: string
  itemTone: RarityTone | 'missing'
  exclusive: boolean
  imageUrl: string | undefined
  reinforce: ReinforceView
  enchant: EnchantView
}

/** 유일 장비의 이름. API는 세트 희귀도 개수에서 유일 장비 부위를 이 이름으로 센다. */
export const EXCLUSIVE_RARITY = '유일'
const EXCLUSIVE_LABEL = '유일 장비'

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
  태초: 'primordial',
  // API가 세트 희귀도 개수에서 유일 장비 부위를 세는 이름이다. 캔버스는 태초와 같은 색에 빛을 더한다.
  [EXCLUSIVE_RARITY]: 'primordial'
}

// 점수 엔진이 건너뛴 사유 종류. 엔진의 원문 메시지는 개발용이라 화면과 보조 기술에 쓰지 않는다.
const skippedReasons: Readonly<Record<string, string>> = {
  input_gate: '입력값이 게임 스탯과 다름',
  resolution: '아이템을 판별하지 못함',
  unresolved: '장비 정보 부족',
  exception: '계산 오류'
}

// 점수 엔진이 근사값을 낸 방법. 모르는 방법은 이름 없이 근사값이라는 뜻만 전한다.
const approximateMethods: Readonly<Record<string, string>> = {
  legacy_fusion_policy_a: '이전 시즌 융합석을 빼고 계산한 값',
  legacy_fusion_policy_a_input_gate_diagnostic:
    '이전 시즌 융합석을 빼고 입력값 차이를 무시하고 계산한 값',
  input_gate_diagnostic: '입력값 차이를 무시하고 계산한 값',
  common_level_skip_computed: '공통 스킬 레벨을 1로 두고 계산한 값'
}

const scoreNote = (label: ScoreView['label']): string =>
  `DFragon 계산값이라 게임 ${label}와 조금 다를 수 있습니다.`

/** 근사값 점수의 화면 글자. 정확한 점수와 구분되게 `≈`를 붙인다. */
export const formatApproximateScore = (value: number): string => `≈${integer.format(value)}`

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

/** 장비 줄의 보조 기술 이름 `부위, 아이템 이름`. 유일 장비는 끝에 `유일 장비`를 붙인다. */
export function toItemLabel(part: string, itemName: string, exclusive: boolean): string {
  if (!exclusive) {
    return `${part}, ${itemName}`
  }

  return `${part}, ${itemName}, ${EXCLUSIVE_LABEL}`
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

function toScoreView(card: CharacterCard | null | undefined): ScoreView {
  const score = card?.score
  const label = card?.role === 'buffer' ? '버프 점수' : '장비 점수'
  const labelTone = { label, tone: card?.role ?? null } as const
  if (score == null) {
    return { ...labelTone, value: null, approximate: false, description: undefined }
  }

  if (score.value != null) {
    return { ...labelTone, value: score.value, approximate: false, description: scoreNote(label) }
  }

  if (score.skipped == null) {
    return { ...labelTone, value: null, approximate: false, description: undefined }
  }
  const { kind } = score.skipped
  const reason = Object.hasOwn(skippedReasons, kind) ? skippedReasons[kind] : '계산 제외'
  if (score.approximate == null) {
    const description = `계산하지 못함, ${reason}`

    return { ...labelTone, value: null, approximate: false, description }
  }
  const { value, source } = score.approximate
  const method = Object.hasOwn(approximateMethods, source)
    ? approximateMethods[source]
    : '정확히 계산하지 못한 추정값'
  const description = `근사값, ${reason}. ${method}이라 게임 ${label}와 1% 넘게 다를 수 있습니다.`

  return { ...labelTone, value, approximate: true, description }
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
 * 캐릭터 면과 공대 카드에 보일 스탯 한 줄, 점수, 서버 순위를 정한다. 점수의 라벨과 색은 카드의 역할을 따른다
 * (버퍼는 `버프 점수`와 초록, 딜러는 `장비 점수`와 파랑, 역할을 모르면 `장비 점수`와 기본색). 계산하지 못한
 * 점수는 값 없이 사유 종류를, 엔진이 근사값을 낸 점수는 그 값과 사유 종류, 근사 방법을, 서버 순위는 수집 범위의
 * 순위라는 뜻을 보조 기술에 전한다. 엔진의 원문 경고와 사유 문구는 개발용이라 쓰지 않는다.
 */
export function toCharacterFace(
  card: CharacterCard | null | undefined,
  labelLength: CardStatLabelLength
): CharacterFaceView {
  return {
    stats: toCardStatItems(card?.stats, labelLength),
    score: toScoreView(card),
    serverRank: toServerRankView(card?.serverRank)
  }
}

function toRarityCounts(counts: readonly { rarity: string; count: number }[]): RarityCountView[] {
  return counts.map(({ rarity, count }) => {
    const exclusive = rarity === EXCLUSIVE_RARITY

    return {
      label: rarity,
      count: integer.format(count),
      tone: toRarityTone(rarity),
      exclusive
    }
  })
}

type SlotRarity = { rarity: string | null; exclusive: boolean }

// 자리별 희귀도로 격자 묶음을 만든다. 장착 정보가 없는 자리는 빈 칸, 희귀도가 null인 자리는 `unknown`이다.
function toRarityGroups<Slot>(
  groups: readonly { id: string; slots: readonly Slot[] }[],
  rarityBySlot: Map<Slot, SlotRarity>,
  cellId: (slot: Slot) => string
): RarityGroupView[] {
  return groups.map(({ id, slots }) => ({
    id,
    main: false,
    cells: slots.map((slot): RarityCellView => {
      const equipped = rarityBySlot.get(slot)
      if (equipped === undefined) {
        return { id: cellId(slot), tone: 'empty', exclusive: false }
      }
      const tone = toRarityTone(equipped.rarity)

      return { id: cellId(slot), tone, exclusive: equipped.exclusive }
    })
  }))
}

// 세트 머리 그림. 115 세트는 세트 아이콘, 그 밖은 대표 장비 그림이다.
function toSetImage(
  set: NonNullable<CharacterCard['set']>,
  itemImages: Readonly<Record<string, string>> | undefined
): Pick<SummaryView, 'image' | 'imageLabel'> {
  const icon = setIcon(set.setItemId)
  if (icon !== undefined) {
    return { image: icon, imageLabel: set.name }
  }

  return { image: toItemImage(set.imageItemId, itemImages), imageLabel: `${set.name} 대표 장비` }
}

/** 서약 그림. 네오플 이미지 API에 서약 그림이 없어 번들한 서약 아이콘을 먼저 쓴다. */
export function toOathImage(
  oath: NonNullable<CharacterCard['oath']>,
  itemImages: Readonly<Record<string, string>> | undefined
): ItemPicture | undefined {
  const icon = oathIcon(oath.rarity, oath.name)
  if (icon !== undefined) {
    return icon
  }

  return toItemImage(oath.itemId, itemImages)
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
    cells: [{ id: 'WEAPON', tone: weaponTone, exclusive: weapon?.exclusive ?? false }]
  }
  const set = card?.set ?? null
  if (set == null) {
    return {
      missing: true,
      name: '세트 정보 없음',
      tone: 'unknown',
      image: undefined,
      imageLabel: '세트',
      pointLabel: '세트 포인트',
      point: MISSING_VALUE,
      groups: [weaponGroup, ...toRarityGroups(setSlotGroups, new Map(), String)],
      counts: []
    }
  }
  const rarityBySlot = new Map(
    set.slots.map(({ slotId, rarity, exclusive }) => [slotId, { rarity, exclusive }])
  )

  return {
    missing: false,
    name: set.name,
    tone: toRarityTone(set.rarityName),
    ...toSetImage(set, itemImages),
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
      return { kind: 'empty', label: `${step}단계 비어 있음` }
    }
    const kind = oathUpgradeKind(optionName)
    if (kind === undefined) {
      return { kind: 'other', label: `${step}단계 · ${optionName}` }
    }

    return { kind, label: `${step}단계 · ${oathUpgradeKindLabels[kind]} (${optionName})` }
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
      image: undefined,
      imageLabel: '서약',
      pointLabel: '서약 포인트',
      point: MISSING_VALUE,
      groups: [
        { id: 'oath', main: true, cells: [{ id: 'oath', tone: 'empty', exclusive: false }] },
        ...toRarityGroups(crystalSlotGroups, new Map(), crystalCellId)
      ],
      counts: [],
      upgrades: toUpgradeCells([])
    }
  }
  const rarityBySlot = new Map(
    oath.crystals.map(({ slotNo, rarity }) => [slotNo, { rarity, exclusive: false }])
  )
  // 캔버스의 서약 제목은 세트 옵션 이름(`여우 : 초월`)이고, 없으면 세트 이름, 서약 아이템 이름 순서로 쓴다.
  const name = oath.optionName ?? oath.setName ?? oath.name
  const bodyTone = toRarityTone(oath.rarity)

  return {
    missing: false,
    name,
    tone: bodyTone,
    image: toOathImage(oath, itemImages),
    imageLabel: oath.name,
    pointLabel: '서약 포인트',
    point: formatPoint(oath.setPoint?.current),
    groups: [
      { id: 'oath', main: true, cells: [{ id: 'oath', tone: bodyTone, exclusive: false }] },
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
        exclusive: false,
        imageUrl: undefined,
        reinforce: toReinforceView(row),
        enchant: toEnchantView(row)
      }
    }

    return {
      slotId,
      itemName: row.itemName,
      itemLabel: toItemLabel(slotName, row.itemName, row.exclusive),
      itemTone: toRarityTone(row.rarity),
      exclusive: row.exclusive,
      imageUrl: toItemImage(row.itemId, itemImages),
      reinforce: toReinforceView(row),
      enchant: toEnchantView(row)
    }
  })
}
