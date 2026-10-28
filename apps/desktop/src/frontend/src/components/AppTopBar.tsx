import { useScreenCaptureContext } from '../hooks/useScreenCaptureContext'
import { BoardHeaderSlot } from './BoardHeaderSlot'
import { CaptureControls } from './CaptureControls'
import { MainNav } from './MainNav'
import { TopBar } from './TopBar'
import { UpdateNoticeSlot } from './UpdateNoticeSlot'

export function AppTopBar(): React.JSX.Element {
  const { partyCapture, controls } = useScreenCaptureContext()

  return (
    <TopBar
      start={<MainNav />}
      center={<BoardHeaderSlot />}
      end={
        <>
          <UpdateNoticeSlot />
          <CaptureControls capture={partyCapture} phase={controls.phase} status={controls.status} />
        </>
      }
    />
  )
}
