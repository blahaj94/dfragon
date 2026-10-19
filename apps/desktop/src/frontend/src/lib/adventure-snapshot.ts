import type { SearchSlot } from '../../../preload/common/types/search'

/** 자리마다 놓인 사람의 모험단명. 빈 자리와 모험단을 모르는 자리는 null이다. */
export type SeatAdventures = readonly (string | null)[]

/**
 * 스냅샷과 비교한 자리의 표시. `moved`는 같은 모험단이 스냅샷에서 있던 자리(1부터)를 칩으로 보이고,
 * `absent`는 스냅샷에 없는 모험단이라 카드 전체에 경고를 덮는다. 표시가 없는 자리는 undefined다.
 */
export type SnapshotMark = Readonly<{ kind: 'moved'; seat: number }> | Readonly<{ kind: 'absent' }>

/**
 * 검색 슬롯의 모험단명. 캐릭터를 찾은 슬롯만 사람이 있는 자리이고, 모험단 조회가 실패해 이름이 없는
 * 자리는 모르는 자리로 본다.
 */
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

/**
 * 스냅샷과 지금 자리를 모험단명으로 비교해 자리마다 표시를 정한다. 사람은 모험단으로 구분하므로 다른
 * 캐릭터여도 같은 모험단이면 같은 사람이다. 스냅샷에 모험단이 있는 자리에 같은 모험단이 그대로 있으면
 * 먼저 그 자리를 맞추고, 나머지는 자리 순서대로 같은 모험단의 남은 스냅샷 자리를 차례로 배정한다. 남은
 * 스냅샷 자리가 없으면 스냅샷보다 많이 들어온 것이라 스냅샷에 없는 모험단으로 본다. 모험단을 모르는
 * 자리는 표시하지 않는다.
 */
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
