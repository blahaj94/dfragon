import type { CharacterChoice, SearchSlot } from '../../../preload/common/types/search'

/**
 * 슬롯에서 누른 후보. 미리보기 조회는 같은 슬롯을 새 요청으로 덮으므로, 처음 누를 때의 후보 목록과 보이던
 * 슬롯을 복사해 둔다. 확정은 `requestId`가 있으면 그 요청이 슬롯에 있는 동안만 후보 창을 닫는다.
 */
export type CandidatePick =
  | Readonly<{
      kind: 'preview'
      serverId: string
      choices: readonly CharacterChoice[]
      shownSlot: SearchSlot
    }>
  | Readonly<{ kind: 'confirmed'; requestId: string | null }>

export type CandidatePicker = Readonly<{
  choices: readonly CharacterChoice[]
  shownServerId: string
  previewServerId: string | null
}>

function closesPicker(slot: SearchSlot, pick: CandidatePick | null): boolean {
  if (pick?.kind !== 'confirmed') {
    return false
  }

  return pick.requestId === null || pick.requestId === slot.requestId
}

export function toCandidatePicker(
  slot: SearchSlot,
  pick: CandidatePick | null
): CandidatePicker | null {
  if (pick?.kind === 'preview') {
    return { choices: pick.choices, shownServerId: pick.serverId, previewServerId: pick.serverId }
  }
  const { choices, selected } = slot
  if (choices === undefined || selected === undefined || closesPicker(slot, pick)) {
    return null
  }

  return { choices, shownServerId: selected.serverId, previewServerId: null }
}

export function nextCandidatePick(
  slot: SearchSlot,
  pick: CandidatePick | null,
  serverId: string
): CandidatePick | null {
  const picker = toCandidatePicker(slot, pick)
  const isChoice = picker?.choices.some((choice) => choice.serverId === serverId) === true
  if (picker === null || !isChoice) {
    return null
  }

  if (pick?.kind !== 'preview') {
    return { kind: 'preview', serverId, choices: picker.choices, shownSlot: slot }
  }

  if (pick.serverId !== serverId) {
    return { ...pick, serverId }
  }
  // 미리보기 조회가 슬롯을 덮지 않았으면 자동으로 고른 후보를 조회 없이 확정한 것이므로, 같은 슬롯의 새 OCR
  // 요청이 후보 창을 다시 열 수 있게 그 요청에만 묶는다.
  const isUnchanged = slot.requestId === pick.shownSlot.requestId
  const requestId = isUnchanged ? slot.requestId : null

  return { kind: 'confirmed', requestId }
}
