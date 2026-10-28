import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    lineHeight: 1
  },
  moved: { boxShadow: `inset 0 0 0 1px ${colors.cardSignal}`, color: colors.cardSignal },
  absent: {
    backgroundColor: `color-mix(in srgb, ${colors.bracketDanger} 16%, transparent)`,
    boxShadow: `inset 0 0 0 1px ${colors.bracketDanger}`,
    color: colors.bracketDanger
  },
  party: { height: 24, gap: 4, paddingInlineEnd: 9, fontSize: 16 },
  partyMoved: { paddingInlineStart: 6 },
  partyAbsent: { paddingInlineStart: 7 },
  raid: { height: 20, gap: 3, paddingInlineEnd: 8, fontSize: 14 },
  raidMoved: { paddingInlineStart: 5 },
  raidAbsent: { paddingInlineStart: 6 }
})
