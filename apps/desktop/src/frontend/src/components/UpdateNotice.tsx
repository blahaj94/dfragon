import { Menu, StatusChip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { ExternalLinkIcon } from './ExternalLinkIcon'
import { styles } from './UpdateNotice.style'

export function UpdateNotice({
  tag,
  onOpenRelease,
  onDismiss
}: {
  tag: string
  onOpenRelease: () => void
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <span role="status" {...stylex.props(windowChromeStyles.noDrag)}>
      <Menu.Root>
        <Menu.Trigger render={<button type="button" {...stylex.props(styles.trigger)} />}>
          <StatusChip tone="signal" size="md">
            새 버전 {tag}
          </StatusChip>
        </Menu.Trigger>
        <Menu.Popup aria-label="새 버전" align="end">
          <Menu.Item onClick={onOpenRelease}>
            <span {...stylex.props(styles.item)}>
              Release 열기
              <ExternalLinkIcon width={14} height={14} />
            </span>
          </Menu.Item>
          <Menu.Item onClick={onDismiss}>
            <span {...stylex.props(styles.item)}>닫기</span>
          </Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    </span>
  )
}
