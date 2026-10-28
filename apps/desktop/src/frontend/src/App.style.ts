import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBlock: space.s12,
    paddingInline: space.s16
  },
  page: { display: 'flex', flexDirection: 'column', minHeight: '100%', gap: space.s16 }
})
