import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  well: { position: 'relative', overflow: 'hidden' },
  party: { flexShrink: 0, width: 72, height: 72 },
  raid: { height: 40 },
  top: {
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      bottom: 0,
      height: 2,
      backgroundColor: colors.tierTop
    }
  },
  ranker: {
    backgroundColor: colors.tierRankerWell,
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      bottom: 0,
      height: 2,
      backgroundColor: colors.tierRanker
    }
  }
})
