import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

const dotBlink = stylex.keyframes({
  '0%': { opacity: 1 },
  '33.333%, 100%': { opacity: 0.25 }
})

export const styles = stylex.create({
  seat: {
    position: 'relative',
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr)',
    minWidth: 0,
    cursor: 'default',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2,
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: 'linear'
  },
  movable: { cursor: { default: 'grab', ':active': 'grabbing' } },
  dragSource: { opacity: 0.35 },
  dragTarget: {
    '::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      boxShadow: `inset 0 0 0 2px ${colors.cardSignal}`,
      pointerEvents: 'none'
    }
  },
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
  well: { position: 'relative', height: 40, overflow: 'hidden' },
  wellTop: {
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      bottom: 0,
      height: 2,
      backgroundColor: colors.tierTop
    }
  },
  wellRanker: {
    backgroundColor: colors.tierRankerWell,
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      bottom: 0,
      height: 2,
      backgroundColor: colors.tierRanker
    }
  },
  portrait: { position: 'absolute', inset: 0 },
  progress: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' },
  column: { display: 'flex', flexDirection: 'column', gap: space.s4, minWidth: 0 },
  header: { display: 'flex', alignItems: 'center', gap: space.s4, minWidth: 0, height: 20 },
  nameField: { flex: '1 1 0', minWidth: 0 },
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
  dots: { display: 'flex', flexShrink: 0, gap: space.s4, paddingInlineEnd: 2 },
  dot: {
    width: 5,
    height: 5,
    backgroundColor: colors.cardSignal,
    opacity: { default: 0.25, '@media (prefers-reduced-motion: reduce)': 1 },
    animationName: { default: dotBlink, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.beat,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  },
  dotSecond: { animationDelay: `calc(${motion.beat} * -2 / 3)` },
  dotThird: { animationDelay: `calc(${motion.beat} / -3)` },
  mark: { display: 'inline-grid', placeItems: 'center', flexShrink: 0, width: 20, height: 20 },
  alert: {
    fontSize: 12,
    lineHeight: '14px',
    backgroundColor: colors.cardFailureWeak,
    color: colors.cardFailure
  },
  waitingMark: { backgroundColor: colors.cardInset, color: colors.cardFgSubtle },
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
  affiliationDivider: {
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
