import type { SearchSlot } from '../../../preload/common/types/search'

export type SeatAdventures = readonly (string | null)[]

export type SnapshotMark = Readonly<{ kind: 'moved'; seat: number }> | Readonly<{ kind: 'absent' }>

export function slotAdventureName(slot: SearchSlot): string | null {
  if (slot.state !== 'success') {
    return null
  }
  const name = slot.selected?.adventureName?.trim()
  if (name === undefined || name === '') {
    return null
  }

  return name
}

export function compareWithSnapshot(
  snapshot: SeatAdventures,
  current: SeatAdventures
): (SnapshotMark | undefined)[] {
  const marks: (SnapshotMark | undefined)[] = current.map(() => undefined)
  const unclaimed = new Set(snapshot.keys())
  const keptInPlace = new Set<number>()
  for (const [seat, adventure] of current.entries()) {
    if (adventure !== null && snapshot[seat] === adventure) {
      unclaimed.delete(seat)
      keptInPlace.add(seat)
    }
  }
  for (const [seat, adventure] of current.entries()) {
    if (adventure === null || keptInPlace.has(seat)) {
      continue
    }
    const from = [...unclaimed].find((index) => snapshot[index] === adventure)
    if (from === undefined) {
      marks[seat] = { kind: 'absent' }
    } else {
      unclaimed.delete(from)
      marks[seat] = { kind: 'moved', seat: from + 1 }
    }
  }

  return marks
}
