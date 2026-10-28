import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useScreenCapture } from './hooks/useScreenCapture'
import { CaptureControls } from './components/CaptureControls'
import { TopBar } from './components/TopBar'
import { MainNav, type SearchMode } from './components/MainNav'
import { PartyScreen } from './pages/party/PartyScreen'
import { RaidScreen } from './pages/raid/RaidScreen'
import { useUpdateNotice } from './hooks/useUpdateNotice'
import { useMainWindowHeight } from './hooks/useMainWindowHeight'
import { UpdateNotice } from './components/UpdateNotice'
import { MAIN_WINDOW_HEIGHTS } from './constants/main-window-heights'
import { styles } from './App.style'

function App(): React.JSX.Element {
  const [searchMode, setSearchMode] = useState<SearchMode>('party')
  // 상단 바의 화면 머리 자리. 보이는 화면이 자기 머리를 이 요소에 그린다.
  const [boardSlot, setBoardSlot] = useState<HTMLDivElement | null>(null)
  const { partyCapture, raidCapture, controls } = useScreenCapture(searchMode)
  const updateNotice = useUpdateNotice()
  // 창 내용 높이는 보이는 화면을 따른다.
  useMainWindowHeight(MAIN_WINDOW_HEIGHTS[searchMode])

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
          <CaptureControls capture={partyCapture} phase={controls.phase} status={controls.status} />
        }
      />
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.page)}>
          {/* 파티 카드는 공대를 보는 동안에도 상태를 유지하도록 숨기기만 한다. */}
          <PartyScreen
            capture={partyCapture}
            hidden={searchMode !== 'party'}
            headerSlot={boardSlot}
          />
          {/* 공대 카드도 파티를 보는 동안 자리별 입력과 검색 상태를 유지하도록 숨기기만 한다. */}
          <RaidScreen capture={raidCapture} hidden={searchMode !== 'raid'} headerSlot={boardSlot} />
        </div>
      </div>
    </main>
  )
}

export default App
