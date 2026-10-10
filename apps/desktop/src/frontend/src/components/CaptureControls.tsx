import { useColorTheme } from '../hooks/useColorTheme'
import { useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import {
  Typo,
  ActionButton,
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogBody,
  DialogFooter
} from '@dfragon/ui'
import { lightTheme } from '../constants/theme.stylex'
import { styles } from './CaptureControls.style'
import { CaptureSourceSelect } from './CaptureSourceSelect'
import { CameraIcon } from './CameraIcon'
import { IconButton } from './IconButton'
import { StatusBadge } from './StatusBadge'
import type { CapturePhase } from '../types/capture'
import { getCaptureControlState, isDnfCaptureSource } from '../lib/capture-presentation'

export type CaptureControlsProps = {
  sources: { id: string; name: string }[]
  selectedSourceId: string
  loading: boolean
  failed: boolean
  phase: CapturePhase
  ready: boolean
  status: string
  onSelect: (id: string) => void
  onRefresh: () => void
  onStop: () => void
}

export function CaptureControls({
  sources,
  selectedSourceId,
  loading,
  failed,
  phase,
  ready,
  status,
  onSelect,
  onRefresh,
  onStop
}: CaptureControlsProps): React.JSX.Element {
  const { light } = useColorTheme()
  const starting = phase === 'selecting' || phase === 'starting'
  const active = phase === 'active'
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const detected = sources.filter(isDnfCaptureSource)
  const others = sources.filter((source) => !detected.includes(source))
  const state = getCaptureControlState({
    phase,
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
        <IconButton
          variant="neutralWeak"
          aria-label="화면 캡처"
          aria-haspopup="dialog"
          icon={<CameraIcon {...stylex.props(styles.camera, active && styles.cameraActive)} />}
        />
      </DialogTrigger>
      <DialogContent
        ref={dialogRef}
        {...stylex.props(styles.dialog, light && lightTheme)}
        title={
          <Typo.h5 as="span" {...stylex.props(styles.heading)}>
            화면 캡처
            <StatusBadge tone={state.tone} role="status">
              {state.label}
            </StatusBadge>
          </Typo.h5>
        }
      >
        <DialogBody>
          <CaptureSourceSelect
            portalContainer={dialogRef}
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
            <Typo.caption as="p" role="status" {...stylex.props(styles.notice)}>
              {status}
            </Typo.caption>
          )}
        </DialogBody>
        <DialogFooter>
          <div {...stylex.props(styles.actions)}>
            <ActionButton size="medium" variant="neutralWeak" onClick={() => setOpen(false)}>
              <Typo.txtM as="span" weight={700}>
                닫기
              </Typo.txtM>
            </ActionButton>
            {(active || starting) && (
              <ActionButton size="medium" variant="brandSolid" onClick={onStop}>
                <Typo.txtM as="span" weight={700}>
                  캡처 중지
                </Typo.txtM>
              </ActionButton>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
