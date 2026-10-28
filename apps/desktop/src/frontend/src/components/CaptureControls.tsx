import { useId } from 'react'
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
import type { CaptureSourceSelection } from '../hooks/usePartyCapture'
import type { CapturePhase } from '../types/capture'
import {
  type CaptureControlTone,
  getCaptureControlState,
  isDnfCaptureSource
} from '../lib/capture-presentation'

export type CaptureControlsProps = {
  source: CaptureSourceSelection
  searchReady: boolean
  stopCapture: () => void
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
  source,
  searchReady,
  stopCapture,
  phase,
  status
}: CaptureControlsProps): React.JSX.Element {
  const { sources, selectedSourceId } = source
  const hasSelection = phase !== 'idle' && selectedSourceId.length > 0
  const titleId = useId()
  const detected = sources.filter(isDnfCaptureSource)
  const others = sources.filter((candidate) => !detected.includes(candidate))
  const state = getCaptureControlState({
    phase,
    loading: source.sourcesLoading,
    failed: source.sourcesFailed,
    hasDetectedSource: detected.length > 0
  })

  function handleOpenChange(open: boolean): void {
    if (open) {
      source.refreshSources()
    }
  }

  return (
    <DialogRoot onOpenChange={handleOpenChange}>
      <span {...stylex.props(windowChromeStyles.noDrag)}>
        <CaptureChipTrigger state={state} />
        <CaptureAnnouncer>{status}</CaptureAnnouncer>
      </span>
      {/* 공용 DialogContent는 화면 가운데에 놓고 전체 창을 덮는다. 이 패널은 상단 바 아래에 붙고 상단 바는
          어둡게 덮지 않으므로 같은 Base UI Dialog를 직접 쓴다. */}
      <Dialog.Portal>
        <Dialog.Backdrop {...stylex.props(styles.backdrop)} />
        <Dialog.Popup aria-labelledby={titleId} {...stylex.props(styles.dialog)}>
          <DialogCorners tone={state.tone} busy={state.busy} />
          <div {...stylex.props(styles.header)}>
            <Typo.caption as="h2" id={titleId} weight={700} {...stylex.props(styles.title)}>
              화면 캡처
            </Typo.caption>
            <StatusChip tone={state.tone} busy={state.busy} role="status">
              {state.label}
            </StatusChip>
            {status && <CaptureNotice phase={phase}>{status}</CaptureNotice>}
            {hasSelection && <StopCaptureButton onClick={stopCapture} />}
            <RefreshSourcesButton
              disabled={source.sourcesLoading}
              onClick={source.refreshSources}
            />
            <CloseDialogButton />
          </div>
          <div {...stylex.props(styles.body)}>
            <CaptureSourceSelect
              detected={detected}
              others={others}
              value={hasSelection ? selectedSourceId : ''}
              loading={source.sourcesLoading}
              failed={source.sourcesFailed}
              ready={searchReady}
              retryStartedAt={source.retryStartedAt}
              onSelect={source.selectSource}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </DialogRoot>
  )
}

function CaptureChipTrigger({
  state
}: {
  state: ReturnType<typeof getCaptureControlState>
}): React.JSX.Element {
  return (
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
  )
}

function CaptureAnnouncer({ children }: { children: string }): React.JSX.Element {
  // 대화상자를 닫은 동안에도 캡처 진행 문구를 보조 기술에 알린다. 대화상자가 열리면 바깥 내용은 가려지고
  // 대화상자 안의 안내가 같은 문구를 알리므로 두 번 읽히지 않는다.
  return (
    <span role="status" data-capture-announcer="" {...stylex.props(shapes.srOnly)}>
      {children}
    </span>
  )
}

function DialogCorners({
  tone,
  busy
}: {
  tone: CaptureControlTone
  busy: boolean
}): React.JSX.Element {
  return (
    <>
      {corners.map(({ position, pulse }, index) => (
        <span
          key={index}
          aria-hidden="true"
          data-tone={tone}
          {...stylex.props(
            styles.corner,
            position,
            styles[tone],
            busy && styles.pulse,
            busy && pulse
          )}
        />
      ))}
    </>
  )
}

function StopCaptureButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  function handleClick(): void {
    onClick()
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleClick}
      {...stylex.props(styles.primaryAction)}
    >
      <Typo.caption as="span" weight={700}>
        캡처 중지
      </Typo.caption>
    </Button>
  )
}

function RefreshSourcesButton({
  disabled,
  onClick
}: {
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  function handleClick(): void {
    onClick()
  }

  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={handleClick}
      {...stylex.props(shapes.cutTopRight, styles.secondaryAction)}
    >
      <Typo.caption as="span" weight={700}>
        새로고침
      </Typo.caption>
    </Button>
  )
}

function CloseDialogButton(): React.JSX.Element {
  return (
    <Dialog.Close
      render={
        <IconButton
          size="sm"
          aria-label="닫기"
          icon={<CloseIcon {...stylex.props(styles.closeIcon)} />}
        />
      }
    />
  )
}

function getNoticeMarkLabel(phase: CapturePhase): string | null {
  if (phase === 'unavailable') {
    return '주의'
  }

  if (phase === 'failed') {
    return '실패'
  }

  return null
}

function CaptureNotice({
  phase,
  children
}: {
  phase: CapturePhase
  children: string
}): React.JSX.Element {
  const markLabel = getNoticeMarkLabel(phase)

  return (
    <p role="status" title={children} {...stylex.props(styles.notice)}>
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
      <span {...stylex.props(styles.noticeText)}>{children}</span>
    </p>
  )
}
