import { getTopBarCaptureControls } from '../lib/capture-presentation'
import type { CapturePhase } from '../types/capture'
import { usePartyCapture, type PartyCapture } from './usePartyCapture'
import { useRaidCapture, type RaidCapture } from './useRaidCapture'
import { useIsPartyMode, useIsRaidMode } from './useSearchModeStore'

export type ScreenCapture = {
  partyCapture: PartyCapture
  raidCapture: RaidCapture
  controls: { phase: CapturePhase; status: string }
}

export function useScreenCapture(): ScreenCapture {
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()
  const partyCapture = usePartyCapture({ receivesShortcut: isPartyMode })
  const raidCapture = useRaidCapture({
    sourceId: partyCapture.source.selectedSourceId,
    sourceReady: partyCapture.source.sourceReady,
    receivesShortcut: isRaidMode,
    recognizeWithOcr: partyCapture.recognizeWithOcr
  })
  const controls = getTopBarCaptureControls({
    isRaidMode,
    party: {
      phase: partyCapture.phase,
      status: partyCapture.status,
      sourceReady: partyCapture.source.sourceReady,
      selectedSourceId: partyCapture.source.selectedSourceId,
      connectionFailed: partyCapture.search.connectionFailed
    },
    raid: { phase: raidCapture.phase, status: raidCapture.status }
  })

  return { partyCapture, raidCapture, controls }
}
