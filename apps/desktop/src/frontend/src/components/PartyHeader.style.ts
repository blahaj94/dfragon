import * as stylex from '@stylexjs/stylex'
import { colors, size, space } from '@dfragon/ui/tokens.stylex'

// dfragon-design layout.md의 파티 머리는 높이 48이고 카드와 16 떨어진다.
export const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s16,
    minHeight: size.controlLg
  },
  title: { display: 'flex', alignItems: 'baseline', gap: space.s12, minWidth: 0 },
  status: { color: colors.fgMuted, minWidth: 0, overflowWrap: 'anywhere' },
  actions: { display: 'flex', alignItems: 'center', gap: space.s8, flexShrink: 0 }
})
