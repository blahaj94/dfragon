import { attachBoardHeaderSlot } from '../hooks/useBoardHeaderPortal'
import { useScreenCaptureContext } from '../hooks/useScreenCaptureContext'
import { CaptureControls } from './CaptureControls'
import { MainNav } from './MainNav'
import { TopBar } from './TopBar'
import { UpdateNoticeSlot } from './UpdateNoticeSlot'

export function AppTopBar(): React.JSX.Element {
  const { partyCapture, controls } = useScreenCaptureContext()

  return (
    <TopBar
      start={<MainNav />}
      centerRef={attachBoardHeaderSlot}
      end={
        <>
          <UpdateNoticeSlot />
          <CaptureControls capture={partyCapture} phase={controls.phase} status={controls.status} />
        </>
      }
    />
  )
}
