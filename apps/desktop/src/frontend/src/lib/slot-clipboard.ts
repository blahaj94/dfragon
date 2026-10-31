import type { SearchSlot } from '../../../preload/common/types/search'
import { serverNames } from '../constants/servers'
import type { CardCharacter } from '../types/cards'
import { toCharacterCard } from './character-card'

export function characterSeatText(
  character: Pick<CardCharacter, 'name' | 'serverId'>,
  adventure: string
): string {
  return `[${character.name}, ${serverNames[character.serverId]}, ${adventure}]`
}

function seatText(slot: SearchSlot | undefined, recognizedNickname: string | null): string {
  const character = slot?.state === 'success' ? toCharacterCard(slot.selected) : undefined
  if (character != null) {
    return characterSeatText(character, slot?.selected?.adventureName ?? '')
  }
  const nickname = slot?.nickname ?? recognizedNickname
  if (nickname == null || nickname === '') {
    return '[]'
  }

  return `[${nickname}, , ]`
}

export function seatRowsText(seats: readonly string[], rowSize: number): string {
  const rows: string[] = []
  for (let start = 0; start < seats.length; start += rowSize) {
    rows.push(seats.slice(start, start + rowSize).join(', '))
  }

  return rows.join(',\n')
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

  return seatRowsText(seats, rowSize)
}
