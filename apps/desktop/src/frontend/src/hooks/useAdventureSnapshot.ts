import { useState } from 'react'
import {
  compareWithSnapshot,
  type SeatAdventures,
  type SnapshotMark
} from '../lib/adventure-snapshot'

/**
 * 모험단 순번 스냅샷. 켜면 지금 자리의 모험단명을 저장하고, 켜진 동안 자리마다 스냅샷과 비교한 표시를
 * 돌려준다. 스냅샷은 이 hook의 메모리에만 있어 IPC와 디스크에 남지 않고 앱을 끄면 사라진다. 파티와 공대는
 * 각자 hook을 써서 따로 가진다.
 */
export function useAdventureSnapshot(current: SeatAdventures): {
  active: boolean
  /** 자리마다 표시. 스냅샷이 없거나 표시할 것이 없는 자리는 undefined다. */
  marks: readonly (SnapshotMark | undefined)[]
  take: () => void
  clear: () => void
} {
  const [snapshot, setSnapshot] = useState<SeatAdventures | null>(null)

  const active = snapshot !== null
  const marks = active ? compareWithSnapshot(snapshot, current) : current.map(() => undefined)

  return {
    active,
    marks,
    take: () => setSnapshot([...current]),
    clear: () => setSnapshot(null)
  }
}
