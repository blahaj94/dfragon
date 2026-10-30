import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  window: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    fontFamily: font.ui,
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
    userSelect: 'none'
  },
  windowSize: (width: number, height: number) => ({ width, height }),
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBlock: space.s12,
    paddingInline: space.s16
  },
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    gap: space.s16
  }
})
