import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { usePartyCapture } from './hooks/usePartyCapture'
import { CaptureControls } from './components/CaptureControls'
import { TopBar } from './components/TopBar'
import { MainNav, type SearchMode } from './components/MainNav'
import { PartyScreen } from './pages/party/PartyScreen'
import { RaidScreen } from './pages/raid/RaidScreen'
import { useRaidCapture } from './hooks/useRaidCapture'
import { useUpdateNotice } from './hooks/useUpdateNotice'
import { UpdateNotice } from './components/UpdateNotice'
import { styles } from './App.style'
import { getRaidScreenCapture } from './lib/capture-presentation'

function App(): React.JSX.Element {
  const [searchMode, setSearchMode] = useState<SearchMode>('party')
  // 상단 바의 화면 머리 자리. 보이는 화면이 자기 머리를 이 요소에 그린다.
  const [boardSlot, setBoardSlot] = useState<HTMLDivElement | null>(null)
  // Alt+R은 지금 보이는 화면의 회차만 시작한다. 게임 창 선택과 중지는 파티 캡처가 소유한다.
  const capture = usePartyCapture({
    identifyCharacters: true,
    receivesShortcut: searchMode === 'party'
  })
  const raidCapture = useRaidCapture({
    sourceId: capture.selectedSourceId,
    sourceReady: capture.sourceReady,
    receivesShortcut: searchMode === 'raid'
  })
  const updateNotice = useUpdateNotice()
  const raidScreenCapture = getRaidScreenCapture({
    party: { phase: capture.phase, status: capture.status, sourceReady: capture.sourceReady },
    raid: { phase: raidCapture.phase, status: raidCapture.status }
  })
  // 상태 칩과 캡처 모달은 보이는 화면의 회차를 알린다.
  const screenCapture =
    searchMode === 'raid' ? raidScreenCapture : { phase: capture.phase, status: capture.status }
  let captureNotice = ''
  if (capture.search.connectionFailed) {
    captureNotice = '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
  } else if (capture.selectedSourceId) {
    captureNotice = screenCapture.status
  }

  return (
    <main {...stylex.props(styles.app)}>
      <TopBar
        nav={<MainNav searchMode={searchMode} onSearchModeChange={setSearchMode} />}
        boardRef={setBoardSlot}
        notice={
          updateNotice.notice != null && (
            <UpdateNotice
              tag={updateNotice.notice.tag}
              onOpenRelease={updateNotice.openRelease}
              onDismiss={updateNotice.dismiss}
            />
          )
        }
        capture={
          <CaptureControls capture={capture} phase={screenCapture.phase} status={captureNotice} />
        }
      />
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.page)}>
          {/* 파티 카드는 공대를 보는 동안에도 상태를 유지하도록 숨기기만 한다. */}
          <PartyScreen capture={capture} hidden={searchMode !== 'party'} headerSlot={boardSlot} />
          {/* 공대 카드도 파티를 보는 동안 자리별 입력과 검색 상태를 유지하도록 숨기기만 한다. */}
          <RaidScreen capture={raidCapture} hidden={searchMode !== 'raid'} headerSlot={boardSlot} />
        </div>
      </div>
    </main>
  )
}

export default App
