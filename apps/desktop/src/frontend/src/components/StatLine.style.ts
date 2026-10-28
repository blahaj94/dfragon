import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    margin: 0,
    fontFamily: font.ui,
    fontSize: 12,
    lineHeight: '14px',
    whiteSpace: 'nowrap'
  },
  stat: { display: 'flex', alignItems: 'center', gap: space.s4, minWidth: 0, margin: 0 },
  label: { margin: 0, fontWeight: 400, color: colors.cardFg },
  value: { margin: 0, fontWeight: 400, color: colors.cardFg },
  divider: { flexShrink: 0, width: 1, height: 10, backgroundColor: colors.cardBorderStrong },
  dealer: { color: colors.scoreDealer },
  buffer: { color: colors.scoreBuffer },
  top: { color: colors.tierTop },
  ranker: { color: colors.tierRanker },
  missing: { color: colors.cardBorderStrong },
  vacant: { color: colors.cardBorder }
})
