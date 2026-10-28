import * as stylex from '@stylexjs/stylex'
import { useScreenCapture } from './hooks/useScreenCapture'
import { useIsPartyMode, useIsRaidMode, useSearchModeStore } from './hooks/useSearchModeStore'
import { AppTopBar } from './components/AppTopBar'
import { PartyScreen } from './pages/party/PartyScreen'
import { RaidScreen } from './pages/raid/RaidScreen'
import { useMainWindowHeight } from './hooks/useMainWindowHeight'
import { MAIN_WINDOW_HEIGHTS } from './constants/main-window-heights'
import { styles } from './App.style'

function App(): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()
  const { partyCapture, raidCapture, controls } = useScreenCapture()
  useMainWindowHeight(MAIN_WINDOW_HEIGHTS[searchMode])

  return (
    <main {...stylex.props(styles.app)}>
      <AppTopBar capture={partyCapture} controls={controls} />
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.page)}>
          {/* 파티 카드는 공대를 보는 동안에도 상태를 유지하도록 숨기기만 한다. */}
          <PartyScreen capture={partyCapture} hidden={!isPartyMode} />
          {/* 공대 카드도 파티를 보는 동안 자리별 입력과 검색 상태를 유지하도록 숨기기만 한다. */}
          <RaidScreen capture={raidCapture} hidden={!isRaidMode} />
        </div>
      </div>
    </main>
  )
}

export default App
