import * as stylex from '@stylexjs/stylex'
import { LOOKUP_STEPS, type LookupStep } from '../lib/card-presentation'
import { styles } from './LookupProgress.style'

export function LookupProgress({
  slot,
  step,
  size
}: {
  slot: number
  step: LookupStep
  size: 'party' | 'raid'
}): React.JSX.Element {
  const current = LOOKUP_STEPS.indexOf(step)

  return (
    <div {...stylex.props(styles.progress)}>
      <div
        role="progressbar"
        aria-label={`${slot}번 캐릭터 확인 중`}
        aria-valuemin={0}
        aria-valuemax={LOOKUP_STEPS.length}
        aria-valuenow={current}
        aria-valuetext={`${step} 중`}
        {...stylex.props(styles.dots, size === 'party' ? styles.party : styles.raid)}
      >
        {LOOKUP_STEPS.map((name, index) => (
          <span
            key={name}
            {...stylex.props(
              styles.dot,
              size === 'party' ? styles.partyDot : styles.raidDot,
              index < current && styles.done,
              index === current && styles.active
            )}
          />
        ))}
      </div>
    </div>
  )
}
