import * as stylex from '@stylexjs/stylex'
import { MAIN_WINDOW_HEIGHTS } from '../../constants/main-window-heights'
import { useMainWindowHeight } from '../../hooks/useMainWindowHeight'
import { useIsPartyMode, useIsRaidMode, useSearchModeStore } from '../../hooks/useSearchModeStore'
import { PartyScreen } from '../party/PartyScreen'
import { RaidScreen } from '../raid/RaidScreen'
import { styles } from './SearchScreen.style'

export function SearchScreen(): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()
  useMainWindowHeight(MAIN_WINDOW_HEIGHTS[searchMode])

  return (
    <div {...stylex.props(styles.content)}>
      <div {...stylex.props(styles.page)}>
        {isPartyMode && <PartyScreen />}
        {isRaidMode && <RaidScreen />}
      </div>
    </div>
  )
}
