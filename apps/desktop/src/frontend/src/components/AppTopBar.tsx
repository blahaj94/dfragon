import type { Ref } from 'react'
import {
  CaptureControls,
  type CaptureControlsProps,
  type CaptureSourceControl
} from './CaptureControls'
import { MainNav, type SearchMode } from './MainNav'
import { TopBar } from './TopBar'
import { UpdateNoticeSlot } from './UpdateNoticeSlot'

/** 메인 창 상단 바에 화면 전환 내비, 새 버전 알림, 게임 연결 상태 칩을 채운다. */
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
