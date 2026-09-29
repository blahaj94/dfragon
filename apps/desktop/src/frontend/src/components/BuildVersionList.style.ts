import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  list: { margin: 0 },
  row: {
    display: 'grid',
    gridTemplateColumns: { default: '160px minmax(0, 1fr)', '@media (max-width: 600px)': '1fr' },
    gap: 12,
    paddingBlock: 18,
    borderBottom: '1px solid',
    borderBottomColor: colors.shellMuted
  },
  value: { margin: 0, minWidth: 0 },
  commit: { overflowWrap: 'anywhere', userSelect: 'text' },
  notice: { color: colors.shellMuted, paddingTop: 8 }
})
