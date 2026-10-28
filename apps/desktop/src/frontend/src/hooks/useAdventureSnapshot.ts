import { useState } from 'react'
import {
  compareWithSnapshot,
  type SeatAdventures,
  type SnapshotMark
} from '../lib/adventure-snapshot'

/**
 * 모험단 순번 스냅샷. 켜면 지금 자리의 모험단명을 저장하고, 켜진 동안 자리마다 스냅샷과 비교한 표시를
 * 돌려준다. 켠 순간이 1번째 회차이고, 그 뒤 `startedRounds`가 오를 때마다 회차 번호도 하나씩 오른다.
 * 스냅샷과 회차 번호는 이 hook의 메모리에만 있어 IPC와 디스크에 남지 않고 앱을 끄면 사라진다. 파티와
 * 공대는 각자 hook을 써서 따로 가진다.
 */
export function useAdventureSnapshot(
  current: SeatAdventures,
  startedRounds: number
): {
  active: boolean
  marks: readonly (SnapshotMark | undefined)[]
  round: number | null
  take: () => void
  clear: () => void
} {
  const [snapshot, setSnapshot] = useState<{
    adventures: SeatAdventures
    startedRoundsAtTake: number
  } | null>(null)

  const active = snapshot !== null
  const marks = active
    ? compareWithSnapshot(snapshot.adventures, current)
    : current.map(() => undefined)
  const round = active ? startedRounds - snapshot.startedRoundsAtTake + 1 : null

  return {
    active,
    marks,
    round,
    take: () => setSnapshot({ adventures: [...current], startedRoundsAtTake: startedRounds }),
    clear: () => setSnapshot(null)
  }
}
