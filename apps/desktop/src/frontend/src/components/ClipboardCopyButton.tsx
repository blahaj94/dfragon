import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import type { ClipboardCopyStatus } from '../hooks/useClipboardCopy'
import { CheckIcon } from './CheckIcon'
import { CopyIcon } from './CopyIcon'
import { ShortcutTooltip } from './ShortcutTooltip'
import { styles } from './ClipboardCopyButton.style'

const FAILURE_MESSAGE = '클립보드에 복사하지 못했습니다.'

export function ClipboardCopyButton({
  status,
  onCopy
}: {
  status: ClipboardCopyStatus
  onCopy: () => void
}): React.JSX.Element {
  const Icon = status === 'copied' ? CheckIcon : CopyIcon
  const announcement = clipboardAnnouncement(status)

  return (
    <>
      {status === 'failed' && (
        <p title={FAILURE_MESSAGE} {...stylex.props(styles.failure)}>
          <span aria-hidden="true" {...stylex.props(shapes.cutTopRight, styles.failureMark)}>
            !
          </span>
          <span {...stylex.props(styles.failureText)}>{FAILURE_MESSAGE}</span>
        </p>
      )}
      <ShortcutTooltip label="복사하기" shortcut="Alt A">
        <span {...stylex.props(windowChromeStyles.noDrag)}>
          <button
            type="button"
            aria-label="클립보드로 복사"
            aria-keyshortcuts="Alt+A"
            onClick={onCopy}
            {...stylex.props(shapes.cutTopRight, styles.button)}
          >
            <Icon width={16} height={16} />
          </button>
        </span>
      </ShortcutTooltip>
      {/* 화면 밖에 두어 헤더 컨트롤 사이 간격을 바꾸지 않는다. */}
      <span role="status" data-clipboard-announcer="" {...stylex.props(shapes.srOnly)}>
        {announcement}
      </span>
    </>
  )
}

function clipboardAnnouncement(status: ClipboardCopyStatus): string {
  if (status === 'copied') {
    return '클립보드로 복사했습니다.'
  }

  if (status === 'failed') {
    return FAILURE_MESSAGE
  }

  return ''
}
