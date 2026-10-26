import * as stylex from '@stylexjs/stylex'
import { Button, Typo } from '@dfragon/ui'
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
    <section aria-label="새 버전 알림" {...stylex.props(styles.notice)}>
      <div role="status" {...stylex.props(styles.message)}>
        <Typo.txtS as="p" weight={700}>
          새 버전 {tag}
        </Typo.txtS>
      </div>
      <div {...stylex.props(styles.actions)}>
        <Button size="sm" onClick={onOpenRelease}>
          <Typo.txtS as="span" weight={700}>
            Release 열기
          </Typo.txtS>
          <ExternalLinkIcon width="16" height="16" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          <Typo.txtS as="span" weight={700}>
            닫기
          </Typo.txtS>
        </Button>
      </div>
    </section>
  )
}
