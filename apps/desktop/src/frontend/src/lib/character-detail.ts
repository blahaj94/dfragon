import { MISSING_VALUE } from '../constants/cards'
import type { CharacterCard } from '../types/cards'
import {
  type RarityTone,
  type ReinforceView,
  crystalSlotGroups,
  setSlotGroups,
  slotNames,
  toItemImage,
  toRarityTone,
  toReinforceView
} from './card-faces'

/**
 * 상세 창 장비 목록의 한 줄(DFragon 디자인 캔버스 상세 창 보드). 아이콘 칸과 이름은 같은 희귀도 색이고, 아이콘은
 * 장식이라 부위와 이름은 `label`로 보조 기술에 전한다. 장착 정보가 없는 줄은 `missing`이고 설명 상자가 없다.
 */
export type DetailItemRowView = {
  id: string
  name: string
  label: string
  tone: RarityTone | 'missing'
  imageUrl: string | undefined
  /** 마법부여 옵션 한 줄. 마법부여가 없으면 null이다. */
  enchant: string | null
  /** 강화나 증폭. 서약 본체와 결정에는 없어 null이다. */
  reinforce: ReinforceView | null
  /** 설명 상자의 `부위 · 희귀도` 줄. */
  kind: string
  /** 묶음의 대표 줄(무기, 서약 본체)이다. */
  lead: boolean
}

/** 상세 창 장비 목록의 묶음. 화면은 묶음 사이를 띄운다. */
export type DetailItemGroupView = { id: string; rows: DetailItemRowView[] }

// 상세 창 장비 목록은 세트 격자와 같은 부위 순서다. 무기 뒤에 방어구, 장신구, 특수 장비를 둔다.
const equipmentGroups = [{ id: 'weapon', slots: ['WEAPON'] }, ...setSlotGroups] as const

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
      imageUrl: undefined,
      enchant: null,
      reinforce: toReinforceView(row),
      kind: part,
      lead
    }
  }

  return {
    id: slotId,
    name: row.itemName,
    label: `${part}, ${row.itemName}`,
    tone: toRarityTone(row.rarity),
    imageUrl: toItemImage(row.itemId, itemImages),
    enchant: toEnchantLine(row.enchant),
    reinforce: toReinforceView(row),
    kind: toKind(part, row.rarity),
    lead
  }
}

/**
 * 상세 창 장비 탭 왼쪽 목록. 무기 하나, 방어구 다섯, 장신구 셋, 특수 장비 셋을 묶음별로 두고, 줄마다 아이템
 * 이름과 희귀도, 마법부여 옵션, 강화나 증폭을 보인다. 카드 값이 없으면 모든 줄이 장착 정보 없음이다.
 * `itemImages`는 합성 미리보기의 로컬 그림이고, 없으면 그림은 itemId로 만든 고정 origin URL이다.
 */
export function toDetailEquipmentGroups(
  card: CharacterCard | null | undefined,
  itemImages?: Readonly<Record<string, string>>
): DetailItemGroupView[] {
  return equipmentGroups.map(({ id, slots }) => ({
    id,
    rows: slots.map((slotId) => toEquipmentRow(card, slotId, itemImages))
  }))
}

/**
 * 상세 창 장비 탭 오른쪽 목록. 서약 본체 하나와 결정 0~2번, 3~10번 묶음을 두고 결정 자리에 장착한 결정이
 * 없으면 장착 정보 없음 줄을 둔다. 서약이 없으면 목록을 비운다.
 */
export function toDetailOathGroups(
  card: CharacterCard | null | undefined,
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
    imageUrl: toItemImage(oath.itemId, itemImages),
    enchant: null,
    reinforce: null,
    kind: toKind('서약', oath.rarity),
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
          imageUrl: undefined,
          enchant: null,
          reinforce: null,
          kind: '서약 결정',
          lead: false
        }
      }

      return {
        id,
        name: crystal.name,
        label: `서약 결정, ${crystal.name}`,
        tone: toRarityTone(crystal.rarity),
        imageUrl: toItemImage(crystal.itemId, itemImages),
        enchant: null,
        reinforce: null,
        kind: toKind('서약 결정', crystal.rarity),
        lead: false
      }
    })
  }))

  return [{ id: 'oath', rows: [body] }, ...crystalGroups]
}
