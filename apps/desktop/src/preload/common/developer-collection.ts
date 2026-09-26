import type { DeveloperCollectionKind, DeveloperPartySlot } from './types/developer'

export const DEVELOPER_COLLECTION_SLOTS = {
  hud: [1, 2, 3, 4],
  participants: [1, 2, 3, 4],
  raid: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
} as const satisfies Record<DeveloperCollectionKind, readonly DeveloperPartySlot[]>

/** Recognizes the collection modes shared by the main and renderer processes. */
export function isDeveloperCollectionKind(value: unknown): value is DeveloperCollectionKind {
  return value === 'hud' || value === 'participants' || value === 'raid'
}

/** A raid row never expands the four-position contract of the other capture modes. */
export function isDeveloperPartySlot(
  value: unknown,
  kind: DeveloperCollectionKind = 'hud'
): value is DeveloperPartySlot {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= (kind === 'raid' ? 12 : 4)
  )
}
