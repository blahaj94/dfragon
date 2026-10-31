import { StatusChip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { BoardHeader } from '../components/BoardHeader'
import { BoardHeaderSlot } from '../components/BoardHeaderSlot'
import { BoardTitle } from '../components/BoardTitle'
import { CandidateImageContext } from '../components/CandidateImage'
import { CaptureButton } from '../components/CaptureButton'
import { ClipboardCopyButton } from '../components/ClipboardCopyButton'
import { LastCaptureTime } from '../components/LastCaptureTime'
import { MainNav } from '../components/MainNav'
import { SnapshotToggle } from '../components/SnapshotToggle'
import { TopBar } from '../components/TopBar'
import { PARTY_SEAT_LAYOUT, RAID_PARTY_SIZE, RAID_SEAT_LAYOUT } from '../constants/cards'
import { MAIN_WINDOW_HEIGHTS } from '../constants/main-window-heights'
import { MAIN_WINDOW_SIZE } from '../../../preload/common/window-chrome'
import { useAdventureSnapshot } from '../hooks/useAdventureSnapshot'
import { useBoardHeaderPortal } from '../hooks/useBoardHeaderPortal'
import { useClipboardCopy } from '../hooks/useClipboardCopy'
import { useSearchModeStore } from '../hooks/useSearchModeStore'
import { type SeatArrangement, useSeatOrder } from '../hooks/useSeatOrder'
import { getCaptureControlState } from '../lib/capture-presentation'
import { type CandidatePick, nextCandidatePick, toCandidatePicker } from '../lib/candidate-picker'
import { type SeatLayout, seatValuesToSlotOrder } from '../lib/seats'
import { characterSeatText, seatRowsText } from '../lib/slot-clipboard'
import { filledSlotCount, type SlotCard } from '../lib/slot-cards'
import { PartyPage } from '../pages/party/PartyPage'
import { RaidPage } from '../pages/raid/RaidPage'
import type { CardCharacter } from '../types/cards'
import type { SearchMode } from '../types/search-mode'
import {
  candidateCharacter,
  candidateImage,
  candidateSlot,
  changedThirdCharacter,
  partyCharacters,
  raidCharacters
} from './characters'
import { useCaptureScript } from './useCaptureScript'
import { styles } from './WindowMockup.style'

const DEFAULT_CANDIDATE_SERVER = 'siroco'

function lookupSlot(): void {}

// 웹사이트에는 Desktop preload가 없어 브라우저 Clipboard API로 쓴다. 보안 컨텍스트가 아니면
// navigator.clipboard가 없으므로, async로 감싸 그 TypeError도 복사 실패로 보이게 한다.
async function writeBrowserClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

function mockupClipboardText(
  characters: readonly CardCharacter[],
  filled: number,
  seatOrder: readonly number[],
  rowSize: number
): string {
  const seats = seatOrder.map((index) =>
    index < filled ? characterSeatText(characters[index], characters[index].adventure) : '[]'
  )

  return seatRowsText(seats, rowSize)
}

export function WindowMockup(): React.JSX.Element {
  const { renderBoardHeader } = useBoardHeaderPortal()
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const { boards, phase, lastCaptureAt, capture } = useCaptureScript(searchMode)
  const partySeats = useSeatOrder(PARTY_SEAT_LAYOUT)
  const raidSeats = useSeatOrder(RAID_SEAT_LAYOUT)
  const [candidatePick, setCandidatePick] = useState<CandidatePick | null>(null)
  const [candidateServer, setCandidateServer] = useState(DEFAULT_CANDIDATE_SERVER)
  const [snapshotRound, setSnapshotRound] = useState<number | null>(null)
  const party = boards.party
  const raid = boards.raid
  const recognizing = phase === 'recognizing'

  const slot = candidateSlot(party.round, candidateServer)
  const picker = toCandidatePicker(slot, candidatePick)
  const shownCandidate =
    candidatePick?.kind === 'preview' ? candidatePick.serverId : candidateServer
  const thirdChanged = snapshotRound !== null && party.round > snapshotRound
  const partyShown: readonly CardCharacter[] = [
    candidateCharacter(shownCandidate),
    partyCharacters[1],
    thirdChanged ? changedThirdCharacter : partyCharacters[2],
    partyCharacters[3]
  ]
  const partySnapshot = useAdventureSnapshot(
    'party',
    partySeats.seatOrder.map((index) =>
      index < party.filled ? partyShown[index].adventure : null
    ),
    party.round
  )
  const raidSnapshot = useAdventureSnapshot(
    'raid',
    raidSeats.seatOrder.map((index) =>
      index < raid.filled ? raidCharacters[index].adventure : null
    ),
    raid.round
  )
  const partyMarks = seatValuesToSlotOrder(partySeats.seatOrder, partySnapshot.marks)
  const partyCards: SlotCard[] = partyShown.map((character, index) => {
    if (index >= party.filled) {
      return { state: 'idle' }
    }
    const cardPicker = index === 0 ? (picker ?? undefined) : undefined

    return { state: 'success', character, snapshotMark: partyMarks[index], picker: cardPicker }
  })
  const clipboardText =
    searchMode === 'party'
      ? mockupClipboardText(partyShown, party.filled, partySeats.seatOrder, partyShown.length)
      : mockupClipboardText(raidCharacters, raid.filled, raidSeats.seatOrder, RAID_PARTY_SIZE)
  const clipboard = useClipboardCopy(clipboardText, writeBrowserClipboard)
  const raidMarks = seatValuesToSlotOrder(raidSeats.seatOrder, raidSnapshot.marks)
  const raidCards: SlotCard[] = raidCharacters.map((character, index) => {
    if (index >= raid.filled) {
      return { state: 'idle' }
    }

    return { state: 'success', character, snapshotMark: raidMarks[index] }
  })
  const captureState = getCaptureControlState({
    phase,
    loading: false,
    failed: false,
    hasDetectedSource: true
  })

  const handleCapture = (): void => {
    setCandidatePick(null)
    capture()
  }
  const handlePickCandidate = (_slot: number, serverId: string): void => {
    const next = nextCandidatePick(slot, candidatePick, serverId)
    if (next?.kind === 'confirmed') {
      setCandidateServer(serverId)
    }
    setCandidatePick(next)
  }
  const handleTakePartySnapshot = (): void => {
    partySnapshot.take()
    setSnapshotRound(party.round)
  }
  const handleClearPartySnapshot = (): void => {
    partySnapshot.clear()
    setSnapshotRound(null)
  }
  const toSeats = (
    layout: SeatLayout,
    { seatOrder, swapSeats }: ReturnType<typeof useSeatOrder>
  ): SeatArrangement => ({
    layout,
    seatOrder,
    canMoveSeats: !recognizing,
    swapSeats: (from, to) => !recognizing && swapSeats(from, to)
  })

  function renderHeaderEnd(target: SearchMode, snapshot: SnapshotControl): React.JSX.Element {
    const label = target === 'party' ? '파티' : '공대'

    return (
      <>
        <LastCaptureTime at={lastCaptureAt} />
        <SnapshotToggle
          label={`${label} 모험단 순번 스냅샷`}
          active={snapshot.active}
          onTake={snapshot.take}
          onClear={snapshot.clear}
        />
        <ClipboardCopyButton status={clipboard.status} onCopy={clipboard.copy} />
        <CaptureButton target={label} disabled={false} onClick={handleCapture} />
      </>
    )
  }

  return (
    <CandidateImageContext value={candidateImage}>
      <div
        {...stylex.props(
          styles.window,
          styles.windowSize(MAIN_WINDOW_SIZE.width, MAIN_WINDOW_HEIGHTS[searchMode])
        )}
      >
        <TopBar
          grade={85}
          start={<MainNav />}
          center={<BoardHeaderSlot />}
          end={
            <StatusChip tone={captureState.tone} busy={captureState.busy} size="md">
              {captureState.label}
            </StatusChip>
          }
        />
        <div {...stylex.props(styles.content)}>
          {searchMode === 'party' && (
            <div {...stylex.props(styles.page)}>
              {renderBoardHeader(
                <BoardHeader
                  start={
                    <BoardTitle
                      label="파티"
                      filled={filledSlotCount(partyCards)}
                      total={partyCards.length}
                      round={partySnapshot.round}
                    />
                  }
                  end={renderHeaderEnd('party', {
                    active: partySnapshot.active,
                    take: handleTakePartySnapshot,
                    clear: handleClearPartySnapshot
                  })}
                />
              )}
              <PartyPage
                slots={partyCards}
                resetKey={String(party.round)}
                seats={toSeats(PARTY_SEAT_LAYOUT, partySeats)}
                actions={{
                  lookupSlot,
                  pickCandidate: handlePickCandidate,
                  changeSnapshotAdventure: partySnapshot.changeAdventure
                }}
              />
            </div>
          )}
          {searchMode === 'raid' && (
            <div {...stylex.props(styles.page)}>
              {renderBoardHeader(
                <BoardHeader
                  start={
                    <BoardTitle
                      label="공대"
                      filled={filledSlotCount(raidCards)}
                      total={raidCards.length}
                      round={raidSnapshot.round}
                    />
                  }
                  end={renderHeaderEnd('raid', raidSnapshot)}
                />
              )}
              <RaidPage
                slots={raidCards}
                resetKey={String(raid.round)}
                seats={toSeats(RAID_SEAT_LAYOUT, raidSeats)}
                actions={{ lookupSlot, changeSnapshotAdventure: raidSnapshot.changeAdventure }}
              />
            </div>
          )}
        </div>
      </div>
    </CandidateImageContext>
  )
}

type SnapshotControl = { active: boolean; take: () => void; clear: () => void }
