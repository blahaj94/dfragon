import { getTopBarCaptureControls } from '../lib/capture-presentation'
import type { CapturePhase } from '../types/capture'
import { usePartyCapture, type PartyCapture } from './usePartyCapture'
import { useRaidCapture, type RaidCapture } from './useRaidCapture'
import { useSearchModeStore } from './useSearchModeStore'

export function useScreenCapture(): {
  partyCapture: PartyCapture
  raidCapture: RaidCapture
  controls: { phase: CapturePhase; status: string }
} {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const partyCapture = usePartyCapture({
    identifyCharacters: true,
    receivesShortcut: searchMode === 'party'
  })
  const raidCapture = useRaidCapture({
    sourceId: partyCapture.selectedSourceId,
    sourceReady: partyCapture.sourceReady,
    receivesShortcut: searchMode === 'raid'
  })
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
