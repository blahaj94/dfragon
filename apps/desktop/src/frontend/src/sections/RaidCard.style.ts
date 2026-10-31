import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  body: {
    display: 'grid',
    gridTemplateColumns: '40px minmax(0, 1fr)',
    alignItems: 'start',
    gap: space.s8,
    flexShrink: 0,
    minHeight: 0,
    paddingBlockStart: space.s8,
    paddingBlockEnd: 6,
    paddingInline: space.s8
  },
  column: { display: 'flex', flexDirection: 'column', gap: space.s4, minWidth: 0 },
  header: { display: 'flex', alignItems: 'center', gap: space.s4, minWidth: 0, height: 20 },
  // 창이 좁아 직업이 두 글자도 들어가지 않으면 구분선만 남지 않도록 직업을 다음 줄로 넘겨 감춘다.
  statRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.s8,
    minWidth: 0,
    height: 14,
    overflow: 'hidden'
  },
  jobGroup: { display: 'flex', alignItems: 'center', gap: space.s8, flex: '1 1 0', minWidth: 48 },
  job: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '14px',
    color: colors.cardFgMuted
  },
  number: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 20,
    paddingInlineStart: 6,
    paddingInlineEnd: space.s8,
    fontSize: 12,
    lineHeight: '14px',
    fontVariantNumeric: 'tabular-nums',
    backgroundColor: colors.cardControl,
    color: colors.cardFgMuted,
    transitionProperty: 'background-color, color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  numberSelected: { backgroundColor: colors.cardSignal, color: colors.cardOnSignal },
  numberTop: { backgroundColor: colors.tierTop, color: colors.cardOnSignal },
  numberRanker: { backgroundColor: colors.tierRanker, color: colors.cardOnSignal },
  affiliation: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    height: 14,
    fontSize: 12,
    lineHeight: '14px',
    whiteSpace: 'nowrap'
  },
  adventure: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: colors.cardFgAdventure
  },
  guild: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: colors.rarityUnique },
  divider: {
    flexShrink: 0,
    width: 1,
    height: 10,
    backgroundColor: colors.cardBorderStrong
  },
  affiliationPlaceholder: { color: colors.cardBorderStrong },
  notice: {
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: colors.cardFgMuted
  }
})
