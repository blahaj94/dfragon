import type { CharacterChoice, SearchSlot } from '../../../preload/common/types/search'

/**
 * 사용자가 후보 줄에서 누른 후보. 캡처 슬롯의 요청 하나에만 해당하며, 요청이 바뀌면 버린다. 동명 후보는
 * 서버마다 한 명이라 서버로 구분한다.
 */
export type CandidatePick = Readonly<{
  requestId: string
  serverId: string
  confirmed: boolean
}>

/** 카드의 후보 줄이 그릴 값 */
export type CandidatePicker = Readonly<{
  choices: readonly CharacterChoice[]
  /** 카드가 지금 보여 주는 후보의 서버. 미리보기가 없으면 자동으로 고른 후보다. */
  shownServerId: string
  /** 한 번 눌러 미리보기 중인 후보의 서버. 없으면 null이다. */
  previewServerId: string | null
}>

/** 같은 요청에서 누른 후보만 남긴다. */
function currentPick(slot: SearchSlot, pick: CandidatePick | null): CandidatePick | null {
  if (pick === null || pick.requestId !== slot.requestId) {
    return null
  }

  return pick
}

/** 캡처 슬롯이 후보를 주고 사용자가 아직 확정하지 않았을 때만 후보 줄을 보인다. */
export function toCandidatePicker(
  slot: SearchSlot,
  pick: CandidatePick | null
): CandidatePicker | null {
  const { choices, selected } = slot
  if (choices === undefined || selected === undefined) {
    return null
  }
  const current = currentPick(slot, pick)
  if (current?.confirmed === true) {
    return null
  }
  const previewServerId = current?.serverId ?? null
  const shownServerId = previewServerId ?? selected.serverId

  return { choices, shownServerId, previewServerId }
}

/**
 * 후보를 누른 뒤의 선택. 미리보기 중인 후보를 다시 누르면 확정하고, 다른 후보를 누르면 그 후보를 미리보기로
 * 옮긴다. 후보 줄이 없는 슬롯이면 null이다.
 */
export function nextCandidatePick(
  slot: SearchSlot,
  pick: CandidatePick | null,
  serverId: string
): CandidatePick | null {
  const picker = toCandidatePicker(slot, pick)
  const requestId = slot.requestId
  const isChoice = picker?.choices.some((choice) => choice.serverId === serverId) === true
  if (picker === null || requestId === null || !isChoice) {
    return null
  }
  const confirmed = picker.previewServerId === serverId

  return { requestId, serverId, confirmed }
}
