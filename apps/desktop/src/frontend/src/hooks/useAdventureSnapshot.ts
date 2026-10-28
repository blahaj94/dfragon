import { create } from 'zustand'
import {
  compareWithSnapshot,
  type SeatAdventures,
  type SnapshotMark
} from '../lib/adventure-snapshot'
import type { SearchMode } from '../types/search-mode'

type AdventureSnapshot = {
  adventures: SeatAdventures
  startedRoundsAtTake: number
}

const useAdventureSnapshotStore = create<{
  snapshots: Record<SearchMode, AdventureSnapshot | null>
  changeSnapshot: (screen: SearchMode, snapshot: AdventureSnapshot | null) => void
}>()((set) => ({
  snapshots: { party: null, raid: null },
  changeSnapshot: (screen, snapshot) =>
    set((state) => ({ snapshots: { ...state.snapshots, [screen]: snapshot } }))
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
  take: () => void
  clear: () => void
} {
  const snapshot = useAdventureSnapshotStore((state) => state.snapshots[screen])
  const changeSnapshot = useAdventureSnapshotStore((state) => state.changeSnapshot)

  const active = snapshot !== null
  const marks = active
    ? compareWithSnapshot(snapshot.adventures, current)
    : current.map(() => undefined)
  const round = active ? startedRounds - snapshot.startedRoundsAtTake + 1 : null

  return {
    active,
    marks,
    round,
    take: () =>
      changeSnapshot(screen, { adventures: [...current], startedRoundsAtTake: startedRounds }),
    clear: () => changeSnapshot(screen, null)
  }
}
