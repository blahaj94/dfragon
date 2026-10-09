import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: colors.cardFg
  },
  largeTable: { maxWidth: 560, marginInline: 'auto' },
  largeCell: { paddingBlock: 4 },
  row: {
    backgroundColor: {
      default: colors.cardBg,
      ':nth-child(even)': colors.cardStripe
    }
  },
  cell: { paddingInline: 6, paddingBlock: 0, textAlign: 'left' },
  value: { textAlign: 'right', whiteSpace: 'nowrap' },
  enhancement: { color: colors.gameAmplify }
})

export const gradeStyles = stylex.create({
  종결: { color: colors.enchantFinal },
  준종결: { color: colors.enchantSemi },
  기타: { color: colors.enchantOther },
  미평가: { color: colors.cardFgMuted }
})
