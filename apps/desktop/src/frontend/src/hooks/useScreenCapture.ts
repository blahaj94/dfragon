import { getTopBarCaptureControls } from '../lib/capture-presentation'
import type { CapturePhase } from '../types/capture'
import { usePartyCapture, type PartyCapture } from './usePartyCapture'
import { useRaidCapture, type RaidCapture } from './useRaidCapture'
import { useIsPartyMode, useIsRaidMode, useSearchModeStore } from './useSearchModeStore'

export type ScreenCapture = {
  partyCapture: PartyCapture
  raidCapture: RaidCapture
  controls: { phase: CapturePhase; status: string }
}

export function useScreenCapture(): ScreenCapture {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()
  const partyCapture = usePartyCapture({
    identifyCharacters: true,
    receivesShortcut: isPartyMode
  })
  const raidCapture = useRaidCapture({
    sourceId: partyCapture.selectedSourceId,
    sourceReady: partyCapture.sourceReady,
    receivesShortcut: isRaidMode
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
