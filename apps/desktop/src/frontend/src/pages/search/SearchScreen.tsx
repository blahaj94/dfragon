import * as stylex from '@stylexjs/stylex'
import { MAIN_WINDOW_HEIGHTS } from '../../constants/main-window-heights'
import { useMainWindowHeight } from '../../hooks/useMainWindowHeight'
import { useIsPartyMode, useIsRaidMode, useSearchModeStore } from '../../hooks/useSearchModeStore'
import { PartyScreen, type PartyScreenCapture } from '../party/PartyScreen'
import { RaidScreen, type RaidScreenCapture } from '../raid/RaidScreen'
import { styles } from './SearchScreen.style'

export function SearchScreen({
  partyCapture,
  raidCapture
}: {
  partyCapture: PartyScreenCapture
  raidCapture: RaidScreenCapture
}): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()
  useMainWindowHeight(MAIN_WINDOW_HEIGHTS[searchMode])

  return (
    <div {...stylex.props(styles.content)}>
      <div {...stylex.props(styles.page)}>
        <PartyScreen capture={partyCapture} hidden={!isPartyMode} />
        <RaidScreen capture={raidCapture} hidden={!isRaidMode} />
      </div>
    </div>
  )
}
