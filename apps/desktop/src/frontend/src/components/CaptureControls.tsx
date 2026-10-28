import { useId, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import {
  Typo,
  Button,
  DialogRoot,
  DialogTrigger,
  IconButton,
  StatusChip,
  shapes
} from '@dfragon/ui'
import { styles } from './CaptureControls.style'
import { CaptureSourceSelect } from './CaptureSourceSelect'
import { CloseIcon } from './CloseIcon'
import type { CapturePhase } from '../types/capture'
import { getCaptureControlState, isDnfCaptureSource } from '../lib/capture-presentation'

export type CaptureSourceControl = {
  sources: { id: string; name: string }[]
  selectedSourceId: string
  sourcesLoading: boolean
  sourcesFailed: boolean
  selectSource: (sourceId: string) => void
  refreshSources: () => void
  stopCapture: (nextStatus?: string) => void
  search: { ready: boolean }
}

export type CaptureControlsProps = {
  capture: CaptureSourceControl
  phase: CapturePhase
  status: string
}

const corners = [
  { position: styles.topLeft, pulse: styles.pulseTopLeft },
  { position: styles.topRight, pulse: styles.pulseTopRight },
  { position: styles.bottomLeft, pulse: styles.pulseBottomLeft },
  { position: styles.bottomRight, pulse: styles.pulseBottomRight }
]

export function CaptureControls({
  capture,
  phase,
  status
}: CaptureControlsProps): React.JSX.Element {
  const { sources, selectedSourceId } = capture
  const hasSelection = phase !== 'idle' && selectedSourceId.length > 0
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const detected = sources.filter(isDnfCaptureSource)
  const others = sources.filter((source) => !detected.includes(source))
  const state = getCaptureControlState({
    phase,
    loading: capture.sourcesLoading,
    failed: capture.sourcesFailed,
    hasDetectedSource: detected.length > 0
  })
  // 창 목록 조회가 끝날 때마다 새 목록 배열이 오고, 그 순간부터 다음 자동 조회까지 15초를 잰다. 목록을
  // 늦게 열어도 재조회 진행 막대가 실제 남은 시간과 맞도록 상단 바에 늘 있는 이 컴포넌트가 시작 시각을
  // 기억한다.
  // 벽시계가 바뀌어도 실제 타이머와 어긋나지 않도록 단조 시계로 잰다.
  const [retry, setRetry] = useState(() => ({ sources, startedAt: performance.now() }))
  if (retry.sources !== sources) {
    setRetry({ sources, startedAt: performance.now() })
  }
  let markLabel: string | null = null
  if (phase === 'unavailable') {
    markLabel = '주의'
  } else if (phase === 'failed') {
    markLabel = '실패'
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(open) => {
        setOpen(open)
        if (open) {
          capture.refreshSources()
        }
      }}
    >
      <span {...stylex.props(windowChromeStyles.noDrag)}>
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
        {/* 대화상자를 닫은 동안에도 캡처 진행 문구를 보조 기술에 알린다. 대화상자가 열리면 바깥 내용은
            가려지고 대화상자 안의 안내가 같은 문구를 알리므로 두 번 읽히지 않는다. */}
        <span role="status" data-capture-announcer="" {...stylex.props(shapes.srOnly)}>
          {status}
        </span>
      </span>
      {/* 공용 DialogContent는 화면 가운데에 놓고 전체 창을 덮는다. 이 패널은 상단 바 아래에 붙고 상단 바는
          어둡게 덮지 않으므로 같은 Base UI Dialog를 직접 쓴다. */}
      <Dialog.Portal>
        <Dialog.Backdrop {...stylex.props(styles.backdrop)} />
        <Dialog.Popup aria-labelledby={titleId} {...stylex.props(styles.dialog)}>
          {corners.map(({ position, pulse }, index) => (
            <span
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
            <Typo.caption as="h2" id={titleId} weight={700} {...stylex.props(styles.title)}>
              화면 캡처
            </Typo.caption>
            <StatusChip tone={state.tone} busy={state.busy} role="status">
              {state.label}
            </StatusChip>
            {status && (
              <p role="status" title={status} {...stylex.props(styles.notice)}>
                {markLabel != null && (
                  <span
                    role="img"
                    aria-label={markLabel}
                    {...stylex.props(
                      shapes.cutTopRight,
                      styles.mark,
                      phase === 'failed' ? styles.failureMark : styles.warningMark
                    )}
                  >
                    !
                  </span>
                )}
                <span {...stylex.props(styles.noticeText)}>{status}</span>
              </p>
            )}
            {hasSelection && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => capture.stopCapture()}
                {...stylex.props(styles.primaryAction)}
              >
                <Typo.caption as="span" weight={700}>
                  캡처 중지
                </Typo.caption>
              </Button>
            )}
            <Button
              size="sm"
              disabled={capture.sourcesLoading}
              onClick={() => capture.refreshSources()}
              {...stylex.props(shapes.cutTopRight, styles.secondaryAction)}
            >
              <Typo.caption as="span" weight={700}>
                새로고침
              </Typo.caption>
            </Button>
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
              loading={capture.sourcesLoading}
              failed={capture.sourcesFailed}
              ready={capture.search.ready}
              retryStartedAt={retry.startedAt}
              onSelect={capture.selectSource}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </DialogRoot>
  )
}
