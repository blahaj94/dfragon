import type { Ref } from 'react'
import {
  CaptureControls,
  type CaptureControlsProps,
  type CaptureSourceControl
} from './CaptureControls'
import { MainNav, type SearchMode } from './MainNav'
import { TopBar } from './TopBar'
import { UpdateNoticeSlot } from './UpdateNoticeSlot'

export function AppTopBar({
  searchMode,
  onSearchModeChange,
  boardRef,
  capture,
  controls
}: {
  searchMode: SearchMode
  onSearchModeChange: (mode: SearchMode) => void
  boardRef: Ref<HTMLDivElement>
  capture: CaptureSourceControl
  controls: Pick<CaptureControlsProps, 'phase' | 'status'>
}): React.JSX.Element {
  return (
    <TopBar
      nav={<MainNav searchMode={searchMode} onSearchModeChange={onSearchModeChange} />}
      boardRef={boardRef}
      notice={<UpdateNoticeSlot />}
      capture={
        <CaptureControls capture={capture} phase={controls.phase} status={controls.status} />
      }
    />
  )
}
