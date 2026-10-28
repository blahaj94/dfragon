import { attachBoardHeaderSlot } from '../hooks/useBoardHeaderPortal'
import { useScreenCaptureContext } from '../hooks/useScreenCaptureContext'
import { useSearchModeStore } from '../hooks/useSearchModeStore'
import { CaptureControls } from './CaptureControls'
import { MainNav } from './MainNav'
import { TopBar } from './TopBar'
import { UpdateNoticeSlot } from './UpdateNoticeSlot'

export function AppTopBar(): React.JSX.Element {
  const { partyCapture, controls } = useScreenCaptureContext()
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const changeSearchMode = useSearchModeStore((state) => state.changeSearchMode)

  return (
    <TopBar
      nav={<MainNav searchMode={searchMode} onSearchModeChange={changeSearchMode} />}
      boardRef={attachBoardHeaderSlot}
      notice={<UpdateNoticeSlot />}
      capture={
        <CaptureControls capture={partyCapture} phase={controls.phase} status={controls.status} />
      }
    />
  )
}
