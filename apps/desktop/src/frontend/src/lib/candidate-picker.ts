import type { CharacterChoice, SearchSlot } from '../../../preload/common/types/search'

export type CandidatePick = Readonly<{
  requestId: string
  serverId: string
  confirmed: boolean
}>

export type CandidatePicker = Readonly<{
  choices: readonly CharacterChoice[]
  shownServerId: string
  previewServerId: string | null
}>

function currentPick(slot: SearchSlot, pick: CandidatePick | null): CandidatePick | null {
  if (pick === null || pick.requestId !== slot.requestId) {
    return null
  }

  return pick
}

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
