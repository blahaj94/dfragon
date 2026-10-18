import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import {
  Typo,
  Button,
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogBody,
  DialogFooter,
  Kbd,
  StatusChip
} from '@dfragon/ui'
import { styles } from './CaptureControls.style'
import { CaptureSourceSelect } from './CaptureSourceSelect'
import { CameraIcon } from './CameraIcon'
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
  const active = phase === 'recognizing' || phase === 'complete'
  const hasSelection = phase !== 'idle' && selectedSourceId.length > 0
  const [open, setOpen] = useState(false)
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
      <span {...stylex.props(windowChromeStyles.noDrag)}>
        {/* 캡처 버튼은 상단 바에 둔다. 키캡은 회차를 시작하는 단축키 Alt+R을 알리는 표시이고, 버튼은
            캡처할 창을 고르는 대화상자를 연다. */}
        <DialogTrigger
          render={
            <Button variant="ghost" size="sm" aria-label="화면 캡처" aria-haspopup="dialog" />
          }
        >
          <CameraIcon
            width={20}
            height={20}
            {...stylex.props(styles.camera, active && styles.cameraActive)}
          />
          <span aria-hidden="true" {...stylex.props(styles.keys)}>
            <Kbd>Alt</Kbd>
            <Kbd>R</Kbd>
          </span>
        </DialogTrigger>
      </span>
      <DialogContent
        {...stylex.props(styles.dialog)}
        title={
          <Typo.h5 as="span" {...stylex.props(styles.heading)}>
            화면 캡처
            <StatusChip tone={state.tone} role="status">
              {state.label}
            </StatusChip>
          </Typo.h5>
        }
      >
        <DialogBody>
          <CaptureSourceSelect
            detected={detected}
            others={others}
            value={hasSelection ? selectedSourceId : ''}
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
            <Button onClick={() => setOpen(false)}>
              <Typo.txtM as="span" weight={700}>
                닫기
              </Typo.txtM>
            </Button>
            {hasSelection && (
              <Button variant="primary" onClick={onStop}>
                <Typo.txtM as="span" weight={700}>
                  캡처 중지
                </Typo.txtM>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
