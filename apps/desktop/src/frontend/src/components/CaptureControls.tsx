import { useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, DialogRoot, DialogTrigger, DialogContent, DialogBody } from '@ldb/ui'
import { lightTheme } from '../constants/theme.stylex'
import { styles } from './CaptureControls.style'
import { CaptureSourceSelect } from './CaptureSourceSelect'
import { CameraIcon } from './CameraIcon'
import { getCaptureControlState } from '../lib/capture-presentation'

export type CaptureControlsProps = {
  light: boolean
  sources: { id: string; name: string }[]
  selectedSourceId: string
  loading: boolean
  failed: boolean
  starting: boolean
  active: boolean
  ready: boolean
  status: string
  onSelect: (id: string) => void
  onRefresh: () => void
  onStop: () => void
}

export function CaptureControls({
  light,
  sources,
  selectedSourceId,
  loading,
  failed,
  starting,
  active,
  ready,
  status,
  onSelect,
  onRefresh,
  onStop
}: CaptureControlsProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const detected = sources.filter((source) =>
    /던전\s*앤\s*파이터|Dungeon.*Fighter|\bDNF\b/i.test(source.name)
  )
  const others = sources.filter((source) => !detected.includes(source))
  const state = getCaptureControlState({
    starting,
    active,
    loading,
    failed,
    hasDetectedSource: detected.length > 0
  })

  return (
    <DialogRoot
      open={open}
      onOpenChange={(open) => {
        setOpen(open)
        if (open) {
          onRefresh()
        }
      }}
    >
      <DialogTrigger asChild>
        <ActionButton size="small" variant="ghost" aria-label="화면 캡처" aria-haspopup="dialog">
          <CameraIcon
            width="20"
            height="20"
            {...stylex.props(styles.camera, (active || starting) && styles.active)}
          />
        </ActionButton>
      </DialogTrigger>
      <DialogContent
        ref={dialogRef}
        {...stylex.props(styles.dialog, light && lightTheme)}
        title={
          <span {...stylex.props(styles.heading)}>
            화면 캡처
            <span role="status" {...stylex.props(styles.state, active && styles.active)}>
              {state}
            </span>
          </span>
        }
      >
        <DialogBody>
          <CaptureSourceSelect
            portalContainer={dialogRef}
            light={light}
            detected={detected}
            others={others}
            value={active || starting ? selectedSourceId : ''}
            loading={loading}
            failed={failed}
            ready={ready}
            onSelect={onSelect}
            onRefresh={onRefresh}
          />
          {status && (
            <p role="status" {...stylex.props(styles.notice)}>
              {status}
            </p>
          )}
        </DialogBody>
        <div {...stylex.props(styles.footer)}>
          <div {...stylex.props(styles.actions)}>
            {(active || starting) && (
              <ActionButton size="small" variant="neutralWeak" onClick={onStop}>
                캡처 중지
              </ActionButton>
            )}
            <ActionButton size="small" variant="neutralWeak" onClick={() => setOpen(false)}>
              닫기
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
