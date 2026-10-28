import type { SearchMode } from '../components/MainNav'
import { getTopBarCaptureControls } from '../lib/capture-presentation'
import type { CapturePhase } from '../types/capture'
import { usePartyCapture, type PartyCapture } from './usePartyCapture'
import { useRaidCapture, type RaidCapture } from './useRaidCapture'

/**
 * 파티, 공대 화면의 캡처를 연결하고 상단 바 캡처 컨트롤 값을 고른다. Alt+R은 지금 보이는 화면의 회차만
 * 시작한다. 게임 창 선택과 중지는 파티 캡처가 소유하며, 공대 캡처는 그 등록 상태를 받는다.
 */
export function useScreenCapture(searchMode: SearchMode): {
  partyCapture: PartyCapture
  raidCapture: RaidCapture
  controls: { phase: CapturePhase; status: string }
} {
  const partyCapture = usePartyCapture({
    identifyCharacters: true,
    receivesShortcut: searchMode === 'party'
  })
  const raidCapture = useRaidCapture({
    sourceId: partyCapture.selectedSourceId,
    sourceReady: partyCapture.sourceReady,
    receivesShortcut: searchMode === 'raid'
  })
  // 상태 칩과 캡처 모달은 보이는 화면의 회차를 알린다.
  const controls = getTopBarCaptureControls({
    searchMode,
    party: {
      phase: partyCapture.phase,
      status: partyCapture.status,
      sourceReady: partyCapture.sourceReady,
      selectedSourceId: partyCapture.selectedSourceId,
      connectionFailed: partyCapture.search.connectionFailed
    },
    raid: { phase: raidCapture.phase, status: raidCapture.status }
  })

  return { partyCapture, raidCapture, controls }
}
