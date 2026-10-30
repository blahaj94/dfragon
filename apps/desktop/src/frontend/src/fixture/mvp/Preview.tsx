import { useMemo, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CaptureControls } from '../../components/CaptureControls'
import { MainNav } from '../../components/MainNav'
import { BoardHeader } from '../../components/BoardHeader'
import { BoardHeaderSlot } from '../../components/BoardHeaderSlot'
import { BoardNotice } from '../../components/BoardNotice'
import { BoardTitle } from '../../components/BoardTitle'
import { CaptureButton } from '../../components/CaptureButton'
import { ClipboardCopyButton } from '../../components/ClipboardCopyButton'
import { LastCaptureTime } from '../../components/LastCaptureTime'
import { SnapshotToggle } from '../../components/SnapshotToggle'
import { TopBar } from '../../components/TopBar'
import { MAIN_WINDOW_HEIGHTS } from '../../constants/main-window-heights'
import { PartyPage } from '../../pages/party/PartyPage'
import { RaidPage } from '../../pages/raid/RaidPage'
import { scenarios } from './scenarios'
import {
  canCapturePreview,
  getCapturePreviewSources,
  getCapturePreviewStatus,
  getCapturePreviewPhase,
  hasCapturePreviewSource
} from './capture-preview'
import { getCharacterPreview } from './character-preview'
import { styles } from './Preview.style'
import {
  candidatePreviewSlots,
  previewCharacter,
  rolePreviewCharacters,
  snapshotPreviewPartyRounds,
  snapshotPreviewRaidRounds,
  tierPreviewCharacters
} from './fixture'
import { useAdventureSnapshot } from '../../hooks/useAdventureSnapshot'
import { useBoardHeaderPortal } from '../../hooks/useBoardHeaderPortal'
import { useIsPartyMode, useIsRaidMode, useSearchModeStore } from '../../hooks/useSearchModeStore'
import type { CardCharacter } from '../../types/cards'
import type { CapturePhase } from '../../types/capture'
import {
  type CandidatePick,
  nextCandidatePick,
  toCandidatePicker
} from '../../lib/candidate-picker'
import { seatValuesToSlotOrder, type SeatLayout } from '../../lib/seats'
import { PARTY_SEAT_LAYOUT, RAID_SEAT_LAYOUT } from '../../constants/cards'
import { useSeatOrder, type SeatArrangement } from '../../hooks/useSeatOrder'
import { filledSlotCount, type SlotCard } from '../../lib/slot-cards'

const EMPTY_CANDIDATE_PICKS: readonly (CandidatePick | null)[] = [null, null, null, null]

type CapturePreviewState = {
  state: string
  selectedSourceId: string
  completedAt: number | null
  retryStartedAt: number
}

type CapturePreview = {
  state: string
  phase: CapturePhase
  status: string
  sources: { id: string; name: string }[]
  selectedSourceId: string
  retryStartedAt: number
  lastCaptureAt: number | null
  canCapture: boolean
  selectSource: (id: string) => void
  stopCapture: () => void
  completeCapture: () => void
  changeState: (state: string) => void
}

function refreshPreviewSources(): void {}

function lookupPreviewSlot(): void {}

function useCapturePreview(): CapturePreview {
  const [capture, setCapture] = useState<CapturePreviewState>(() => ({
    state: 'idle',
    selectedSourceId: '',
    completedAt: null,
    retryStartedAt: performance.now()
  }))
  const { state, selectedSourceId, completedAt, retryStartedAt } = capture
  // 캡처 창은 목록 배열이 바뀔 때 재조회가 끝난 것으로 보고 진행 막대를 다시 채우므로, 미리보기 상태가
  // 바뀔 때만 새 목록을 만든다.
  const sources = useMemo(() => getCapturePreviewSources(state), [state])
  const lastCaptureAt = state === 'complete' ? completedAt : null

  const selectSource = (id: string): void => {
    const nextState = id.length > 0 ? 'selected' : 'idle'
    setCapture((current) => ({ ...current, state: nextState, selectedSourceId: id }))
  }
  const stopCapture = (): void => {
    setCapture((current) => ({ ...current, state: 'idle', selectedSourceId: '' }))
  }
  const completeCapture = (): void => {
    const capturedAt = Date.now()
    setCapture((current) => ({ ...current, state: 'complete', completedAt: capturedAt }))
  }
  const changeState = (nextState: string): void => {
    const nextSourceId = hasCapturePreviewSource(nextState) ? 'preview-game' : ''
    const nextCompletedAt = nextState === 'complete' ? Date.now() - 12_000 : null
    setCapture({
      state: nextState,
      selectedSourceId: nextSourceId,
      completedAt: nextCompletedAt,
      retryStartedAt: performance.now()
    })
  }

  return {
    state,
    phase: getCapturePreviewPhase(state),
    status: getCapturePreviewStatus(state),
    sources,
    selectedSourceId,
    retryStartedAt,
    lastCaptureAt,
    canCapture: canCapturePreview(state),
    selectSource,
    stopCapture,
    completeCapture,
    changeState
  }
}

export function Preview(): React.JSX.Element {
  const { renderBoardHeader } = useBoardHeaderPortal()
  const [scenario, setScenario] = useState('states')
  const capture = useCapturePreview()
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()
  const partySeats = useSeatOrder(PARTY_SEAT_LAYOUT)
  const raidSeats = useSeatOrder(RAID_SEAT_LAYOUT)
  const [partyRound, setPartyRound] = useState(0)
  const [raidRound, setRaidRound] = useState(0)
  const [candidatePicks, setCandidatePicks] = useState(EMPTY_CANDIDATE_PICKS)
  const character = getCharacterPreview(scenario, previewCharacter)
  const identification = scenario === 'identification'
  const partySlots = scenarios[scenario]
  const partyCharacters = getPartyPreviewCharacters({
    scenario,
    character,
    partyRound,
    slotCount: partySlots.length
  })
  const raidCharacters = snapshotPreviewRaidRounds[raidRound % snapshotPreviewRaidRounds.length]
  const partySnapshot = useAdventureSnapshot(
    'party',
    partySeats.seatOrder.map((slot) => {
      const state = partySlots[slot]
      const shown = partyCharacters[slot]
      if (state !== 'success' || shown == null) {
        return null
      }

      return shown.adventure
    }),
    partyRound
  )
  const raidSnapshot = useAdventureSnapshot(
    'raid',
    raidSeats.seatOrder.map((slot) => {
      const adventure = raidCharacters[slot]?.adventure
      if (adventure == null) {
        return null
      }

      return adventure
    }),
    raidRound
  )
  const identificationNotices = [
    undefined,
    undefined,
    undefined,
    '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  ]
  const identificationNicknames = [null, '검색예시', '결과없음', '오류예시']
  const candidates = scenario === 'candidates'
  const candidatePickers = candidates
    ? candidatePreviewSlots.map((slot, index) => toCandidatePicker(slot, candidatePicks[index]))
    : []
  const pickCandidate = (slot: number, serverId: string): void => {
    const next = nextCandidatePick(candidatePreviewSlots[slot], candidatePicks[slot], serverId)
    setCandidatePicks(candidatePicks.map((current, index) => (index === slot ? next : current)))
  }
  const partySnapshotMarks = seatValuesToSlotOrder(partySeats.seatOrder, partySnapshot.marks)
  const partyCards: SlotCard[] = partySlots.map((state, slot) => {
    const shown = partyCharacters[slot]
    const selected = shown ?? undefined
    const nickname = identification ? (identificationNicknames[slot] ?? undefined) : undefined
    const notice = identification ? identificationNotices[slot] : undefined
    const picker = candidatePickers[slot] ?? undefined

    return {
      state,
      character: selected,
      nickname,
      notice,
      snapshotMark: partySnapshotMarks[slot],
      picker
    }
  })
  const raidSnapshotMarks = seatValuesToSlotOrder(raidSeats.seatOrder, raidSnapshot.marks)
  const raidCards: SlotCard[] = raidCharacters.map((member, slot) => {
    const state = member == null ? 'idle' : 'success'
    const selected = member ?? undefined

    return { state, character: selected, snapshotMark: raidSnapshotMarks[slot] }
  })
  const canMoveSeats = capture.phase !== 'recognizing'

  const handleCaptureParty = (): void => {
    capture.completeCapture()
    setPartyRound((round) => round + 1)
  }
  const handleCaptureRaid = (): void => {
    capture.completeCapture()
    setRaidRound((round) => round + 1)
  }
  const toPreviewSeats = (
    layout: SeatLayout,
    { seatOrder, swapSeats }: ReturnType<typeof useSeatOrder>
  ): SeatArrangement => ({
    layout,
    seatOrder,
    canMoveSeats,
    swapSeats: (from, to) => canMoveSeats && swapSeats(from, to)
  })
  const handleCaptureStateChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    capture.changeState(event.target.value)
  }
  const handleScenarioChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setScenario(event.target.value)
    setCandidatePicks(EMPTY_CANDIDATE_PICKS)
  }

  return (
    <>
      <main {...stylex.props(styles.app, styles.windowHeight(MAIN_WINDOW_HEIGHTS[searchMode]))}>
        <TopBar
          grade={85}
          start={<MainNav />}
          center={<BoardHeaderSlot />}
          end={
            <CaptureControls
              source={{
                sources: capture.sources,
                sourcesLoading: false,
                sourcesFailed: false,
                retryStartedAt: capture.retryStartedAt,
                refreshSources: refreshPreviewSources,
                selectedSourceId: capture.selectedSourceId,
                sourceReady: capture.selectedSourceId.length > 0,
                selectSource: capture.selectSource
              }}
              searchReady
              stopCapture={capture.stopCapture}
              phase={capture.phase}
              status={capture.status}
            />
          }
        />
        <div {...stylex.props(styles.content)}>
          {isPartyMode && (
            <div {...stylex.props(styles.page)}>
              {renderBoardHeader(
                <BoardHeader
                  start={
                    <>
                      <BoardTitle
                        label="파티"
                        filled={partySlots.filter((state) => state === 'success').length}
                        total={partySlots.length}
                        round={partySnapshot.round}
                      />
                    </>
                  }
                  end={
                    <>
                      <LastCaptureTime at={capture.lastCaptureAt} />
                      <SnapshotToggle
                        label="파티 모험단 순번 스냅샷"
                        active={partySnapshot.active}
                        onTake={partySnapshot.take}
                        onClear={partySnapshot.clear}
                      />
                      <ClipboardCopyButton status="idle" onCopy={() => undefined} />
                      <CaptureButton
                        target="파티"
                        disabled={!capture.canCapture}
                        onClick={handleCaptureParty}
                      />
                    </>
                  }
                />
              )}
              <PartyPage
                slots={partyCards}
                resetKey={scenario}
                seats={toPreviewSeats(PARTY_SEAT_LAYOUT, partySeats)}
                actions={{ lookupSlot: lookupPreviewSlot, pickCandidate }}
              />
            </div>
          )}
          {isRaidMode && (
            <div {...stylex.props(styles.page)}>
              {renderBoardHeader(
                <BoardHeader
                  start={
                    <>
                      <BoardTitle
                        label="공대"
                        filled={filledSlotCount(raidCards)}
                        total={raidCards.length}
                        round={raidSnapshot.round}
                      />
                      <BoardNotice>{''}</BoardNotice>
                    </>
                  }
                  end={
                    <>
                      <LastCaptureTime at={capture.lastCaptureAt} />
                      <SnapshotToggle
                        label="공대 모험단 순번 스냅샷"
                        active={raidSnapshot.active}
                        onTake={raidSnapshot.take}
                        onClear={raidSnapshot.clear}
                      />
                      <ClipboardCopyButton status="idle" onCopy={() => undefined} />
                      <CaptureButton
                        target="공대"
                        disabled={!capture.canCapture}
                        onClick={handleCaptureRaid}
                      />
                    </>
                  }
                />
              )}
              <RaidPage
                slots={raidCards}
                resetKey="raid"
                seats={toPreviewSeats(RAID_SEAT_LAYOUT, raidSeats)}
                actions={{ lookupSlot: lookupPreviewSlot }}
              />
            </div>
          )}
        </div>
      </main>
      <footer {...stylex.props(styles.footer)}>
        <span>던삐삐 Desktop</span>
        <select
          aria-label="캡처 미리보기 상태"
          value={capture.state}
          onChange={handleCaptureStateChange}
          {...stylex.props(styles.select)}
        >
          <option value="idle">캡처, 대기</option>
          <option value="selecting">캡처, 준비 중</option>
          <option value="selected">캡처, 창 선택됨</option>
          <option value="recognizing">캡처, 인식 중</option>
          <option value="complete">캡처, 인식 완료</option>
          <option value="unavailable">캡처, 확인 필요</option>
          <option value="missing">캡처, 창 미감지</option>
          <option value="failure">캡처, 실패</option>
        </select>
        <select
          aria-label="미리보기 상태"
          value={scenario}
          onChange={handleScenarioChange}
          {...stylex.props(styles.select)}
        >
          <option value="states">기본, 상태 비교</option>
          <option value="pending">검색 중, 결과 없음</option>
          <option value="missing">누락, 이미지 실패</option>
          <option value="identification">자동 식별 상태</option>
          <option value="tiers">상위, 랭커 단계</option>
          <option value="roles">점수 라벨, 역할 비교</option>
          <option value="snapshot">모험단 순번 스냅샷</option>
          <option value="candidates">후보 고르기</option>
        </select>
      </footer>
      <p {...stylex.props(styles.notice)}>
        합성 데이터 미리보기입니다.
        <br />
        캡처 모달은 합성 창으로 동작하며 실제 화면을 캡처하지 않습니다. 이름 입력, 서버 선택은 조작
        확인용이며 검색되지 않습니다.
      </p>
    </>
  )
}

function getPartyPreviewCharacters({
  scenario,
  character,
  partyRound,
  slotCount
}: {
  scenario: string
  character: CardCharacter
  partyRound: number
  slotCount: number
}): readonly (CardCharacter | null)[] {
  if (scenario === 'identification') {
    const identifiedCharacter = {
      ...character,
      characterId: 'preview-selected',
      fame: null,
      card: null
    }

    return [identifiedCharacter, null, null, null]
  }

  if (scenario === 'tiers') {
    return tierPreviewCharacters
  }

  if (scenario === 'roles') {
    return rolePreviewCharacters
  }

  if (scenario === 'snapshot') {
    return snapshotPreviewPartyRounds[partyRound % snapshotPreviewPartyRounds.length]
  }

  return Array.from({ length: slotCount }, () => character)
}
