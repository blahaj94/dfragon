import type { Ref } from 'react'
import { useSearchModeStore } from '../hooks/useSearchModeStore'
import {
  CaptureControls,
  type CaptureControlsProps,
  type CaptureSourceControl
} from './CaptureControls'
import { MainNav } from './MainNav'
import { TopBar } from './TopBar'
import { UpdateNoticeSlot } from './UpdateNoticeSlot'

export function AppTopBar({
  boardRef,
  capture,
  controls
}: {
  boardRef: Ref<HTMLDivElement>
  capture: CaptureSourceControl
  controls: Pick<CaptureControlsProps, 'phase' | 'status'>
}): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const changeSearchMode = useSearchModeStore((state) => state.changeSearchMode)

  return (
    <TopBar
      nav={<MainNav searchMode={searchMode} onSearchModeChange={changeSearchMode} />}
      boardRef={boardRef}
      notice={<UpdateNoticeSlot />}
      capture={
        <CaptureControls capture={capture} phase={controls.phase} status={controls.status} />
      }
    />
  )
}
