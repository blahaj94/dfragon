import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: colors.text
  },
  largeTable: { maxWidth: 560, marginInline: 'auto' },
  largeCell: { paddingBlock: 4 },
  row: {
    backgroundColor: {
      default: colors.card,
      ':nth-child(even)': colors.alternate
    }
  },
  cell: { paddingInline: 6, paddingBlock: 0, textAlign: 'left' },
  value: { textAlign: 'right', whiteSpace: 'nowrap' },
  enhancement: { color: '#ff75f5' }
})

export const gradeStyles = stylex.create({
  종결: { color: '#50e3c2' },
  준종결: { color: '#ffb400' },
  기타: { color: '#ffffff' },
  미평가: { color: colors.muted }
})
