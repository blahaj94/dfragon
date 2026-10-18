import { useId, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import {
  Typo,
  Button,
  DialogRoot,
  DialogTrigger,
  DialogContent,
  IconButton,
  StatusChip,
  shapes
} from '@dfragon/ui'
import { styles } from './CaptureControls.style'
import { CaptureSourceSelect } from './CaptureSourceSelect'
import { CloseIcon } from './CloseIcon'
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

const corners = [
  { position: styles.topLeft, pulse: styles.pulseTopLeft },
  { position: styles.topRight, pulse: styles.pulseTopRight },
  { position: styles.bottomLeft, pulse: styles.pulseBottomLeft },
  { position: styles.bottomRight, pulse: styles.pulseBottomRight }
]

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
  const titleId = useId()
  const detected = sources.filter(isDnfCaptureSource)
  const others = sources.filter((source) => !detected.includes(source))
  const state = getCaptureControlState({
    phase,
    loading,
    failed,
    hasDetectedSource: detected.length > 0
  })
  // 창 목록 조회가 끝날 때마다 새 목록 배열이 오고, 그 순간부터 다음 자동 조회까지 15초를 잰다. 목록을
  // 늦게 열어도 재조회 진행 막대가 실제 남은 시간과 맞도록 상단 바에 늘 있는 이 컴포넌트가 시작 시각을
  // 기억한다.
  const [retry, setRetry] = useState(() => ({ sources, startedAt: Date.now() }))
  if (retry.sources !== sources) {
    setRetry({ sources, startedAt: Date.now() })
  }

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
          <StatusChip tone={state.tone} busy={state.busy} size="md">
            {state.label}
          </StatusChip>
        </DialogTrigger>
      </span>
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        {...stylex.props(styles.dialog)}
      >
        {/* DFragon 디자인 캔버스의 캡처 보드대로 대화상자 네 모서리 꺾쇠가 상태 색을 따른다. 인식하는
            동안은 꺾쇠가 박자 두 번마다 바깥에서 조여 든다. */}
        {corners.map(({ position, pulse }, index) => (
          <span
            // 네 모서리는 순서가 바뀌지 않는 고정 목록이다.
            key={index}
            aria-hidden="true"
            data-tone={state.tone}
            {...stylex.props(
              styles.corner,
              position,
              styles[state.tone],
              state.busy && styles.pulse,
              state.busy && pulse
            )}
          />
        ))}
        <div {...stylex.props(styles.header)}>
          <Typo.h6 as="h2" id={titleId} weight={700} {...stylex.props(styles.title)}>
            화면 캡처
          </Typo.h6>
          <StatusChip tone={state.tone} busy={state.busy} role="status">
            {state.label}
          </StatusChip>
          <IconButton
            size="sm"
            aria-label="닫기"
            icon={<CloseIcon {...stylex.props(styles.closeIcon)} />}
            onClick={() => setOpen(false)}
          />
        </div>
        <div {...stylex.props(styles.body)}>
          <CaptureSourceSelect
            detected={detected}
            others={others}
            value={hasSelection ? selectedSourceId : ''}
            loading={loading}
            failed={failed}
            ready={ready}
            retryStartedAt={retry.startedAt}
            onSelect={onSelect}
            onRefresh={onRefresh}
          />
          {status && (
            <p role="status" {...stylex.props(styles.notice)}>
              {phase === 'unavailable' && (
                <span
                  role="img"
                  aria-label="주의"
                  {...stylex.props(shapes.cutTopRight, styles.warningMark)}
                >
                  !
                </span>
              )}
              {status}
            </p>
          )}
        </div>
        <div {...stylex.props(styles.actions)}>
          <Button onClick={() => setOpen(false)} {...stylex.props(styles.secondaryAction)}>
            <Typo.txtS as="span" weight={700}>
              닫기
            </Typo.txtS>
          </Button>
          {hasSelection && (
            <Button variant="primary" onClick={onStop} {...stylex.props(styles.primaryAction)}>
              <Typo.txtS as="span" weight={700}>
                캡처 중지
              </Typo.txtS>
            </Button>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
