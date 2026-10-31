import type { SearchSlot } from '../../../preload/common/types/search'
import { serverNames } from '../constants/servers'
import { toCharacterCard } from './character-card'

function seatText(slot: SearchSlot | undefined, recognizedNickname: string | null): string {
  const character = slot?.state === 'success' ? toCharacterCard(slot.selected) : undefined
  if (character != null) {
    const adventure = slot?.selected?.adventureName ?? ''

    return `[${character.name}, ${serverNames[character.serverId]}, ${adventure}]`
  }
  const nickname = slot?.nickname ?? recognizedNickname
  if (nickname == null || nickname === '') {
    return '[]'
  }

  return `[${nickname}, , ]`
}

export function toClipboardText({
  slots,
  nicknames,
  seatOrder,
  rowSize
}: {
  slots: readonly SearchSlot[]
  nicknames: readonly (string | null)[]
  seatOrder: readonly number[]
  rowSize: number
}): string {
  const seats = seatOrder.map((slot) => seatText(slots[slot], nicknames[slot] ?? null))
  const rows: string[] = []
  for (let start = 0; start < seats.length; start += rowSize) {
    rows.push(seats.slice(start, start + rowSize).join(', '))
  }

  return rows.join(',\n')
}
