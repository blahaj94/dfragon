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
  StatusChip
} from '@dfragon/ui'
import { styles } from './CaptureControls.style'
import { CaptureSourceSelect } from './CaptureSourceSelect'
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
        {/* 상단 바의 게임 연결 상태 칩이 캡처할 창을 고르는 대화상자를 연다. 회차는 Alt+R이나 파티 머리의
            캡처 버튼이 시작한다. */}
        <DialogTrigger
          render={
            <button
              type="button"
              aria-label={`화면 캡처, ${state.label}`}
              {...stylex.props(styles.trigger)}
            />
          }
        >
          <StatusChip tone={state.tone} size="md">
            {state.label}
          </StatusChip>
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
