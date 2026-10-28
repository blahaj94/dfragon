import { useId, useMemo, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CaptureControls } from '../../components/CaptureControls'
import { MainNav } from '../../components/MainNav'
import { BoardHeader } from '../../components/BoardHeader'
import { BoardHeaderSlot } from '../../components/BoardHeaderSlot'
import { BoardNotice } from '../../components/BoardNotice'
import { BoardTitle } from '../../components/BoardTitle'
import { CaptureButton } from '../../components/CaptureButton'
import { LastCaptureTime } from '../../components/LastCaptureTime'
import { SnapshotToggle } from '../../components/SnapshotToggle'
import { TopBar } from '../../components/TopBar'
import { PartyPage } from '../../pages/party/PartyPage'
import { RaidPage } from '../../pages/raid/RaidPage'
import { scenarios } from './scenarios'
import {
  getCapturePreviewSources,
  getCapturePreviewStatus,
  getCapturePreviewPhase
} from './capture-preview'
import { getCharacterPreview } from './character-preview'
import { styles } from './Preview.style'
import {
  candidatePreviewChoices,
  previewCharacter,
  rolePreviewCharacters,
  snapshotPreviewPartyRounds,
  snapshotPreviewRaidRounds,
  tierPreviewCharacters
} from './fixture'
import { useAdventureSnapshot } from '../../hooks/useAdventureSnapshot'
import { useBoardHeaderPortal } from '../../hooks/useBoardHeaderPortal'
import { useSearchModeStore } from '../../hooks/useSearchModeStore'
import type { CardCharacter } from '../../types/cards'
import { createSeatOrder, seatValuesToSlotOrder, swapSeats } from '../../lib/raid-seats'
import { filledSlotCount, type SlotCard } from '../../lib/slot-cards'
import { MAIN_WINDOW_SIZE } from '../../../../preload/common/window-chrome'

export function Preview(): React.JSX.Element {
  const { renderBoardHeader } = useBoardHeaderPortal()
  const [scenario, setScenario] = useState('states')
  const [captureState, setCaptureState] = useState('idle')
  const [source, setSource] = useState('')
  const [completedAt, setCompletedAt] = useState<number | null>(null)
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const [seatOrder, setSeatOrder] = useState(createSeatOrder)
  const [partyRound, setPartyRound] = useState(0)
  const [raidRound, setRaidRound] = useState(0)
  const raidCardsId = useId()
  const windowHeight =
    searchMode === 'raid' ? MAIN_WINDOW_SIZE.raidHeight : MAIN_WINDOW_SIZE.partyHeight
  const [candidatePicks, setCandidatePicks] = useState<
    readonly ({ serverId: string; confirmed: boolean } | null)[]
  >([null, null, null, null])
  // 캡처 창은 목록 배열이 바뀔 때 재조회가 끝난 것으로 보고 진행 막대를 다시 채우므로, 미리보기 상태가
  // 바뀔 때만 새 목록을 만든다.
  const sources = useMemo(() => getCapturePreviewSources(captureState), [captureState])
  const phase = getCapturePreviewPhase(captureState)
  const canCapture =
    phase === 'selected' ||
    phase === 'recognizing' ||
    phase === 'complete' ||
    phase === 'unavailable'
  const character = getCharacterPreview(scenario, previewCharacter)
  const identification = scenario === 'identification'
  const identifiedCharacter = {
    ...character,
    characterId: 'preview-selected',
    fame: null,
    card: null
  }
  let characters: readonly (CardCharacter | null)[] | undefined
  if (identification) {
    characters = [identifiedCharacter, null, null, null]
  } else if (scenario === 'tiers') {
    characters = tierPreviewCharacters
  } else if (scenario === 'roles') {
    characters = rolePreviewCharacters
  } else if (scenario === 'snapshot') {
    characters = snapshotPreviewPartyRounds[partyRound % snapshotPreviewPartyRounds.length]
  }
  const partySlots = scenarios[scenario]
  const raidCharacters = snapshotPreviewRaidRounds[raidRound % snapshotPreviewRaidRounds.length]
  const partySnapshot = useAdventureSnapshot(
    partySlots.map((state, slot) => {
      const shown = characters === undefined ? character : characters[slot]
      if (state !== 'success' || shown == null) {
        return null
      }

      return shown.adventure
    }),
    partyRound
  )
  const raidSnapshot = useAdventureSnapshot(
    seatOrder.map((slot) => {
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
  const identificationNicknames = [null, '얼굴대기', '기준대기', '오류예시']
  const identificationRetryEnabled = [false, false, false, true]
  const candidates = scenario === 'candidates'
  const candidatePickers = candidatePreviewChoices.map((choices, slot) => {
    const pick = candidatePicks[slot]
    if (!candidates || choices === null || pick?.confirmed === true) {
      return undefined
    }
    const previewServerId = pick?.serverId ?? null
    const shownServerId = previewServerId ?? choices[0].serverId

    return { choices, shownServerId, previewServerId }
  })
  const pickCandidate = (slot: number, serverId: string): void => {
    const pick = candidatePicks[slot]
    const confirmed = pick?.serverId === serverId
    setCandidatePicks(
      candidatePicks.map((current, index) => (index === slot ? { serverId, confirmed } : current))
    )
  }
  const partyCards: SlotCard[] = partySlots.map((state, slot) => {
    const shown = characters === undefined ? character : characters[slot]
    const selected = shown ?? undefined
    const nickname = identification ? (identificationNicknames[slot] ?? undefined) : undefined
    const notice = identification ? identificationNotices[slot] : undefined
    const retryEnabled = identification ? identificationRetryEnabled[slot] : undefined

    return {
      state,
      character: selected,
      nickname,
      notice,
      snapshotMark: partySnapshot.marks[slot],
      retryEnabled,
      picker: candidatePickers[slot]
    }
  })
  const raidSnapshotMarks = seatValuesToSlotOrder(seatOrder, raidSnapshot.marks)
  const raidCards: SlotCard[] = raidCharacters.map((member, slot) => {
    const state = member == null ? 'idle' : 'success'
    const selected = member ?? undefined

    return { state, character: selected, snapshotMark: raidSnapshotMarks[slot] }
  })

  return (
    <>
      <main {...stylex.props(styles.app, styles.windowHeight(windowHeight))}>
        <TopBar
          start={<MainNav />}
          center={<BoardHeaderSlot />}
          end={
            <CaptureControls
              capture={{
                sources,
                selectedSourceId: source,
                sourcesLoading: false,
                sourcesFailed: false,
                selectSource: (id) => {
                  setSource(id)
                  setCaptureState(id ? 'selected' : 'idle')
                },
                refreshSources: () => {},
                stopCapture: () => {
                  setSource('')
                  setCaptureState('idle')
                },
                search: { ready: true }
              }}
              phase={phase}
              status={getCapturePreviewStatus(captureState)}
            />
          }
        />
        <div {...stylex.props(styles.content)}>
          <div hidden={searchMode !== 'party'} {...stylex.props(styles.page)}>
            {searchMode === 'party' &&
              renderBoardHeader(
                <BoardHeader
                  start={
                    <>
                      <BoardTitle
                        label="파티"
                        filled={partySlots.filter((state) => state === 'success').length}
                        total={partySlots.length}
                        round={partySnapshot.round}
                      />
                      <BoardNotice />
                    </>
                  }
                  end={
                    <>
                      <LastCaptureTime at={captureState === 'complete' ? completedAt : null} />
                      <SnapshotToggle
                        label="파티 모험단 순번 스냅샷"
                        active={partySnapshot.active}
                        onTake={partySnapshot.take}
                        onClear={partySnapshot.clear}
                      />
                      <CaptureButton
                        target="파티"
                        disabled={!canCapture}
                        onClick={() => {
                          setCaptureState('complete')
                          setCompletedAt(Date.now())
                          setPartyRound((round) => round + 1)
                        }}
                      />
                    </>
                  }
                />
              )}
            <PartyPage
              slots={partyCards}
              resetKey={scenario}
              inputEnabled
              actions={{
                retrySlot: identification ? () => setScenario('pending') : undefined,
                pickCandidate: candidates ? pickCandidate : undefined
              }}
            />
          </div>
          {searchMode === 'raid' && (
            <div {...stylex.props(styles.page)}>
              <RaidPage
                id={raidCardsId}
                header={renderBoardHeader(
                  <BoardHeader
                    start={
                      <>
                        <BoardTitle
                          label="공대"
                          filled={filledSlotCount(raidCards)}
                          total={raidCards.length}
                          round={raidSnapshot.round}
                        />
                        <BoardNotice />
                      </>
                    }
                    end={
                      <>
                        <LastCaptureTime at={captureState === 'complete' ? completedAt : null} />
                        <SnapshotToggle
                          label="공대 모험단 순번 스냅샷"
                          active={raidSnapshot.active}
                          onTake={raidSnapshot.take}
                          onClear={raidSnapshot.clear}
                        />
                        <CaptureButton
                          target="공대"
                          disabled={!canCapture}
                          onClick={() => {
                            setCaptureState('complete')
                            setCompletedAt(Date.now())
                            setRaidRound((round) => round + 1)
                          }}
                        />
                      </>
                    }
                  />
                )}
                slots={raidCards}
                seats={{
                  seatOrder,
                  canMoveSeats: phase !== 'recognizing',
                  swapSeats: (from, to) => {
                    const next = swapSeats(seatOrder, from, to)
                    if (phase === 'recognizing' || next === seatOrder) {
                      return false
                    }
                    setSeatOrder(next)

                    return true
                  }
                }}
              />
            </div>
          )}
        </div>
      </main>
      <footer {...stylex.props(styles.footer)}>
        <span>DFragon Desktop</span>
        <select
          aria-label="캡처 미리보기 상태"
          value={captureState}
          onChange={(event) => {
            const state = event.target.value
            setCaptureState(state)
            setCompletedAt(state === 'complete' ? Date.now() - 12_000 : null)
            const hasSource =
              state === 'selecting' ||
              state === 'selected' ||
              state === 'complete' ||
              state === 'recognizing' ||
              state === 'unavailable'
            setSource(hasSource ? 'preview-game' : '')
          }}
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
          onChange={(event) => {
            setScenario(event.target.value)
            setCandidatePicks([null, null, null, null])
          }}
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
