import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import { ExternalLinkIcon } from './ExternalLinkIcon'
import { styles } from './UpdateNotice.style'

export function UpdateNotice({
  tag,
  endsOcrCollection,
  onOpenRelease,
  onDismiss
}: {
  tag: string
  endsOcrCollection: boolean
  onOpenRelease: () => void
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <section aria-label="새 버전 알림" {...stylex.props(styles.notice)}>
      <div role="status" {...stylex.props(styles.message)}>
        <Typo.txtS as="p" weight={700}>
          새 버전 {tag}
        </Typo.txtS>
        {endsOcrCollection && (
          <Typo.caption as="p" {...stylex.props(styles.detail)}>
            이 버전으로 바꾸면 OCR 자료 수집이 꺼집니다.
          </Typo.caption>
        )}
      </div>
      <div {...stylex.props(styles.actions)}>
        <ActionButton size="small" variant="neutralWeak" onClick={onOpenRelease}>
          <Typo.txtS as="span" weight={700}>
            Release 열기
          </Typo.txtS>
          <ExternalLinkIcon width="16" height="16" />
        </ActionButton>
        <ActionButton size="small" variant="ghost" onClick={onDismiss}>
          <Typo.txtS as="span" weight={700}>
            닫기
          </Typo.txtS>
        </ActionButton>
      </div>
    </section>
  )
}
