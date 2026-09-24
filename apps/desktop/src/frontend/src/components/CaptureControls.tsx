import { useColorTheme } from '../hooks/useColorTheme'
import { useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Typo, ActionButton, DialogRoot, DialogTrigger, DialogContent, DialogBody } from '@dfragon/ui'
import { lightTheme } from '../constants/theme.stylex'
import { styles } from './CaptureControls.style'
import { CaptureSourceSelect } from './CaptureSourceSelect'
import { CameraIcon } from './CameraIcon'
import type { CapturePhase } from '../types/capture'
import { getCaptureControlState } from '../lib/capture-presentation'

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
  const detected = sources.filter((source) =>
    /던전\s*앤\s*파이터|Dungeon.*Fighter|\bDNF\b/i.test(source.name)
  )
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
          <Typo.h5 as="span" {...stylex.props(styles.heading)}>
            화면 캡처
            <Typo.txtS
              as="span"
              weight={700}
              role="status"
              {...stylex.props(styles.state, active && styles.active)}
            >
              {state}
            </Typo.txtS>
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
        <div {...stylex.props(styles.footer)}>
          <div {...stylex.props(styles.actions)}>
            {(active || starting) && (
              <ActionButton size="small" variant="neutralWeak" onClick={onStop}>
                <Typo.txtS as="span" weight={700}>
                  캡처 중지
                </Typo.txtS>
              </ActionButton>
            )}
            <ActionButton size="small" variant="neutralWeak" onClick={() => setOpen(false)}>
              <Typo.txtS as="span" weight={700}>
                닫기
              </Typo.txtS>
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
