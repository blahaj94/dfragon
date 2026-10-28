import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useScreenCapture } from './hooks/useScreenCapture'
import { AppTopBar } from './components/AppTopBar'
import type { SearchMode } from './components/MainNav'
import { PartyScreen } from './pages/party/PartyScreen'
import { RaidScreen } from './pages/raid/RaidScreen'
import { useMainWindowHeight } from './hooks/useMainWindowHeight'
import { MAIN_WINDOW_HEIGHTS } from './constants/main-window-heights'
import { styles } from './App.style'

function App(): React.JSX.Element {
  const [searchMode, setSearchMode] = useState<SearchMode>('party')
  const [boardSlot, setBoardSlot] = useState<HTMLDivElement | null>(null)
  const { partyCapture, raidCapture, controls } = useScreenCapture(searchMode)
  useMainWindowHeight(MAIN_WINDOW_HEIGHTS[searchMode])

  return (
    <main {...stylex.props(styles.app)}>
      <AppTopBar
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        boardRef={setBoardSlot}
        capture={partyCapture}
        controls={controls}
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
