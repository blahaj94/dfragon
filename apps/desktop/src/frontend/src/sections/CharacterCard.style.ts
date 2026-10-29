import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, space } from '@dfragon/ui/tokens.stylex'

const dotBlink = stylex.keyframes({
  '0%': { opacity: 1 },
  '33.333%, 100%': { opacity: 0.25 }
})

const numeric = {
  fontFamily: font.num,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  letterSpacing: 0
} as const

const THUMBNAIL_SIZE = 72
const LINE_HEIGHT = 14

const ellipsis = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

export const styles = stylex.create({
  slot: {
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr)',
    // 줄일 수 없는 내용이 있어도 카드가 그리드 칸보다 넓어지지 않게 한다.
    gridTemplateColumns: 'minmax(0, 1fr)',
    minWidth: 0,
    position: 'relative'
  },
  body: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    flexShrink: 0,
    minWidth: 0,
    paddingTop: space.s8,
    paddingInline: 10,
    paddingBottom: space.s8
  },
  well: {
    position: 'relative',
    flexShrink: 0,
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    overflow: 'hidden'
  },
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
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    flex: '1 1 0',
    minWidth: 0
  },
  header: { display: 'flex', alignItems: 'center', gap: space.s4, minWidth: 0 },
  // 칸의 테두리 1과 안쪽 여백 4만큼 왼쪽으로 내밀어 이름 글자가 아래 줄 글자와 같은 세로줄에 오게 한다.
  nameField: { display: 'grid', flex: '1 1 0', minWidth: 0, marginInlineStart: -5 },
  dots: { display: 'flex', flexShrink: 0, gap: space.s4, paddingInline: space.s4 },
  dot: {
    width: 4,
    height: 4,
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
    ...numeric,
    fontSize: 14,
    fontWeight: 700,
    backgroundColor: colors.cardFailureWeak,
    color: colors.cardFailure
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    minHeight: LINE_HEIGHT
  },
  lineDivider: {
    flexShrink: 0,
    width: 1,
    height: 10,
    backgroundColor: colors.cardBorderStrong
  },
  adventure: { ...ellipsis, color: colors.cardFgAdventure },
  guild: { ...ellipsis, color: colors.rarityUnique },
  job: { ...ellipsis, flex: '0 1 auto', color: colors.cardFgMuted },
  message: { ...ellipsis, flex: '1 1 0', margin: 0, color: colors.cardFgMuted },
  placeholder: { color: colors.cardBorderStrong },
  candidateChip: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 20,
    paddingInlineStart: 6,
    paddingInlineEnd: space.s8,
    borderWidth: 0,
    backgroundColor: { default: colors.cardControl, ':hover': colors.cardControlHover },
    boxShadow: `inset 0 0 0 1px ${colors.cardSignal}`,
    color: colors.cardSignal,
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    outline: { default: null, ':focus-visible': `2px solid ${colors.cardSignal}` },
    outlineOffset: { default: null, ':focus-visible': 2 }
  }
})
