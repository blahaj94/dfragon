import { ProgressCircle } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { styles } from './LookupProgress.style'

export function LookupProgress({ slot }: { slot: number }): React.JSX.Element {
  return (
    <div role="status" aria-label={`${slot}번 캐릭터 확인 중`} {...stylex.props(styles.progress)}>
      <ProgressCircle size="24" tone="staticWhite" />
    </div>
  )
}
