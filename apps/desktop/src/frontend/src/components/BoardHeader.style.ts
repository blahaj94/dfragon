import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexGrow: 1,
    minWidth: 0
  },
  start: { display: 'flex', alignItems: 'baseline', gap: space.s8, minWidth: 0 },
  end: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    flexShrink: 0,
    marginInlineStart: 'auto'
  }
})
