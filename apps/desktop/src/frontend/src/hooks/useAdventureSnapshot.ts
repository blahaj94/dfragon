import { create } from 'zustand'
import {
  compareWithSnapshot,
  type SeatAdventures,
  type SnapshotMark
} from '../lib/adventure-snapshot'
import type { SearchMode } from '../types/search-mode'

type AdventureSnapshot = {
  adventures: SeatAdventures
  typedAdventures: readonly string[]
  startedRoundsAtTake: number
}

const useAdventureSnapshotStore = create<{
  snapshots: Record<SearchMode, AdventureSnapshot | null>
  changeSnapshot: (screen: SearchMode, snapshot: AdventureSnapshot | null) => void
  changeTypedAdventure: (screen: SearchMode, seat: number, value: string) => void
}>()((set) => ({
  snapshots: { party: null, raid: null },
  changeSnapshot: (screen, snapshot) =>
    set((state) => ({ snapshots: { ...state.snapshots, [screen]: snapshot } })),
  changeTypedAdventure: (screen, seat, value) =>
    set((state) => {
      const snapshot = state.snapshots[screen]
      if (snapshot === null) {
        return state
      }
      const typedAdventures = snapshot.typedAdventures.with(seat, value)

      return { snapshots: { ...state.snapshots, [screen]: { ...snapshot, typedAdventures } } }
    })
}))

/**
 * 모험단 순번 스냅샷. 켜면 지금 자리의 모험단명을 저장하고, 켜진 동안 자리마다 스냅샷과 비교한 표시를
 * 돌려준다. 켠 순간이 1번째 회차이고, 그 뒤 `startedRounds`가 오를 때마다 회차 번호도 하나씩 오른다.
 * 스냅샷과 회차 번호는 renderer 메모리의 화면별 store에만 있어 다른 화면을 보고 와도 남고, IPC와 디스크에
 * 남지 않아 앱을 끄면 사라진다.
 */
export function useAdventureSnapshot(
  screen: SearchMode,
  current: SeatAdventures,
  startedRounds: number
): {
  active: boolean
  marks: readonly (SnapshotMark | undefined)[]
  round: number | null
  adventureInputs: readonly (string | undefined)[]
  take: () => void
  clear: () => void
  changeAdventure: (seat: number, value: string) => void
} {
  const snapshot = useAdventureSnapshotStore((state) => state.snapshots[screen])
  const changeSnapshot = useAdventureSnapshotStore((state) => state.changeSnapshot)
  const changeTypedAdventure = useAdventureSnapshotStore((state) => state.changeTypedAdventure)

  const active = snapshot !== null
  const marks = active
    ? compareWithSnapshot(
        snapshot.adventures.map(
          (adventure, seat) => adventure ?? snapshot.typedAdventures[seat].trim()
        ),
        current
      )
    : current.map(() => undefined)
  const round = active ? startedRounds - snapshot.startedRoundsAtTake + 1 : null
  const adventureInputs =
    active && round === 1
      ? snapshot.adventures.map((adventure, seat) =>
          adventure === null ? snapshot.typedAdventures[seat] : undefined
        )
      : current.map(() => undefined)

  return {
    active,
    marks,
    round,
    adventureInputs,
    take: () =>
      changeSnapshot(screen, {
        adventures: [...current],
        typedAdventures: current.map(() => ''),
        startedRoundsAtTake: startedRounds
      }),
    clear: () => changeSnapshot(screen, null),
    changeAdventure: (seat, value) => changeTypedAdventure(screen, seat, value)
  }
}
