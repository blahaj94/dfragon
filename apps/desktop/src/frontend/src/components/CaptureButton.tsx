import { Button } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { CameraIcon } from './CameraIcon'
import { ShortcutTooltip } from './ShortcutTooltip'
import { styles } from './CaptureButton.style'

export function CaptureButton({
  target,
  disabled,
  onClick
}: {
  target: string
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <ShortcutTooltip label="캡처하기" shortcut="Alt R">
      <span {...stylex.props(windowChromeStyles.noDrag)}>
        <Button
          variant="primary"
          size="sm"
          aria-label={`${target} 캡처, 단축키 Alt R`}
          aria-keyshortcuts="Alt+R"
          disabled={disabled}
          onClick={onClick}
          {...stylex.props(styles.button)}
        >
          <CameraIcon width={16} height={16} />
        </Button>
      </span>
    </ShortcutTooltip>
  )
}
