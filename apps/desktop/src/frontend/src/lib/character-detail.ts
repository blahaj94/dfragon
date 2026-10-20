import type { CharacterDetailItemTexts } from '../../../preload/common/types/character-detail'
import { MISSING_VALUE } from '../constants/cards'
import type { CharacterCard } from '../types/cards'
import type { ItemPicture } from './equipment-icons'
import {
  type RarityTone,
  type ReinforceView,
  crystalSlotGroups,
  setSlotGroups,
  slotNames,
  toItemImage,
  toOathImage,
  toRarityTone,
  toReinforceView
} from './card-faces'

/**
 * 설명 상자의 아이템 문구(DFragon 디자인 캔버스 상세 창 보드). 아이템 설명의 첫 줄이 `[...]`이면 `heading`으로
 * 떼어 강조하고 나머지를 `explain`에 둔다. 문구가 없으면 그 칸은 null이다.
 */
export type DetailItemTextView = {
  heading: string | null
  explain: string | null
  buff: string | null
  flavor: string | null
}

/**
 * 상세 창 장비 목록의 한 줄(DFragon 디자인 캔버스 상세 창 보드). 아이콘 칸과 이름은 같은 희귀도 색이고, 아이콘은
 * 장식이라 부위와 이름은 `label`로 보조 기술에 전한다. 장착 정보가 없는 줄은 `missing`이고 설명 상자가 없다.
 */
export type DetailItemRowView = {
  id: string
  name: string
  label: string
  tone: RarityTone | 'missing'
  image: ItemPicture | undefined
  /** 마법부여 옵션 한 줄. 마법부여가 없으면 null이다. */
  enchant: string | null
  /** 강화나 증폭. 서약 본체와 결정에는 없어 null이다. */
  reinforce: ReinforceView | null
  /** 설명 상자의 `부위 · 희귀도` 줄. */
  kind: string
  /** 설명 상자의 아이템 설명, 버프 스킬, 플레이버 문구. */
  text: DetailItemTextView
  /** 묶음의 대표 줄(무기, 서약 본체)이다. */
  lead: boolean
}

/** 상세 창 장비 목록의 묶음. 화면은 묶음 사이를 띄운다. */
export type DetailItemGroupView = { id: string; rows: DetailItemRowView[] }

// 상세 창 장비 목록은 세트 격자와 같은 부위 순서다. 무기 뒤에 방어구, 장신구, 특수 장비를 둔다.
const equipmentGroups = [{ id: 'weapon', slots: ['WEAPON'] }, ...setSlotGroups] as const

const EMPTY_TEXT: DetailItemTextView = { heading: null, explain: null, buff: null, flavor: null }

// 캔버스 상세 창 보드처럼 아이템 설명 첫 줄의 `[용을 베는 자]` 같은 제목을 떼어 둔다.
function splitExplain(explain: string | null): Pick<DetailItemTextView, 'heading' | 'explain'> {
  if (explain === null) {
    return { heading: null, explain: null }
  }
  const [first, ...rest] = explain.split('\n')
  const heading = first.trim()
  if (!heading.startsWith('[') || !heading.endsWith(']')) {
    return { heading: null, explain }
  }
  const body = rest.join('\n')
  const bodyText = body.trim().length > 0 ? body : null

  return { heading, explain: bodyText }
}

function toTextView(
  itemId: string | null | undefined,
  itemTexts: CharacterDetailItemTexts | undefined
): DetailItemTextView {
  if (itemId == null || itemTexts === undefined || !Object.hasOwn(itemTexts, itemId)) {
    return EMPTY_TEXT
  }
  const { explain, buff, flavor } = itemTexts[itemId]

  return { ...splitExplain(explain), buff, flavor }
}

function toKind(part: string, rarity: string | null): string {
  if (rarity == null) {
    return part
  }

  return `${part} · ${rarity}`
}

// 마법부여 옵션을 카드 값의 이름과 수치 그대로 한 줄로 잇는다. 이름을 줄이거나 묶지 않는다.
function toEnchantLine(enchant: CharacterCard['investment'][number]['enchant']): string | null {
  if (enchant == null || enchant.status.length === 0) {
    return null
  }

  return enchant.status.map(({ name, value }) => `${name} ${value}`).join(' · ')
}

function toEquipmentRow(
  card: CharacterCard | null | undefined,
  slotId: string,
  itemTexts: CharacterDetailItemTexts | undefined,
  itemImages: Readonly<Record<string, string>> | undefined
): DetailItemRowView {
  const row = card?.investment.find((item) => item.slotId === slotId)
  const part = row?.slotName ?? slotNames[slotId]
  const lead = slotId === 'WEAPON'
  if (row?.itemName == null) {
    return {
      id: slotId,
      name: MISSING_VALUE,
      label: `${part}, 장착 정보 없음`,
      tone: 'missing',
      image: undefined,
      enchant: null,
      reinforce: toReinforceView(row),
      kind: part,
      text: EMPTY_TEXT,
      lead
    }
  }

  return {
    id: slotId,
    name: row.itemName,
    label: `${part}, ${row.itemName}`,
    tone: toRarityTone(row.rarity),
    image: toItemImage(row.itemId, itemImages),
    enchant: toEnchantLine(row.enchant),
    reinforce: toReinforceView(row),
    kind: toKind(part, row.rarity),
    text: toTextView(row.itemId, itemTexts),
    lead
  }
}

/**
 * 상세 창 장비 탭 왼쪽 목록. 무기 하나, 방어구 다섯, 장신구 셋, 특수 장비 셋을 묶음별로 두고, 줄마다 아이템
 * 이름과 희귀도, 마법부여 옵션, 강화나 증폭을 보인다. 카드 값이 없으면 모든 줄이 장착 정보 없음이다.
 * 설명 상자 문구는 `itemTexts`에서 줄의 itemId로 찾는다. `itemImages`는 합성 미리보기의 로컬 그림이고, 없으면
 * 그림은 itemId로 만든 고정 origin URL이다.
 */
export function toDetailEquipmentGroups(
  card: CharacterCard | null | undefined,
  itemTexts?: CharacterDetailItemTexts,
  itemImages?: Readonly<Record<string, string>>
): DetailItemGroupView[] {
  return equipmentGroups.map(({ id, slots }) => ({
    id,
    rows: slots.map((slotId) => toEquipmentRow(card, slotId, itemTexts, itemImages))
  }))
}

/**
 * 상세 창 장비 탭 오른쪽 목록. 서약 본체 하나와 결정 0~2번, 3~10번 묶음을 두고 결정 자리에 장착한 결정이
 * 없으면 장착 정보 없음 줄을 둔다. 서약이 없으면 목록을 비운다. 설명 상자 문구는 장비 목록처럼 찾는다.
 */
export function toDetailOathGroups(
  card: CharacterCard | null | undefined,
  itemTexts?: CharacterDetailItemTexts,
  itemImages?: Readonly<Record<string, string>>
): DetailItemGroupView[] {
  const oath = card?.oath ?? null
  if (oath == null) {
    return []
  }
  const body: DetailItemRowView = {
    id: 'oath',
    name: oath.name,
    label: `서약, ${oath.name}`,
    tone: toRarityTone(oath.rarity),
    image: toOathImage(oath, itemImages),
    enchant: null,
    reinforce: null,
    kind: toKind('서약', oath.rarity),
    text: toTextView(oath.itemId, itemTexts),
    lead: true
  }
  const crystalBySlot = new Map(oath.crystals.map((crystal) => [crystal.slotNo, crystal]))
  const crystalGroups = crystalSlotGroups.map(({ id, slots }) => ({
    id,
    rows: slots.map((slotNo): DetailItemRowView => {
      const crystal = crystalBySlot.get(slotNo)
      const id = `crystal-${slotNo}`
      if (crystal === undefined) {
        return {
          id,
          name: MISSING_VALUE,
          label: '서약 결정, 장착 정보 없음',
          tone: 'missing',
          image: undefined,
          enchant: null,
          reinforce: null,
          kind: '서약 결정',
          text: EMPTY_TEXT,
          lead: false
        }
      }

      return {
        id,
        name: crystal.name,
        label: `서약 결정, ${crystal.name}`,
        tone: toRarityTone(crystal.rarity),
        image: toItemImage(crystal.itemId, itemImages),
        enchant: null,
        reinforce: null,
        kind: toKind('서약 결정', crystal.rarity),
        text: toTextView(crystal.itemId, itemTexts),
        lead: false
      }
    })
  }))

  return [{ id: 'oath', rows: [body] }, ...crystalGroups]
}
