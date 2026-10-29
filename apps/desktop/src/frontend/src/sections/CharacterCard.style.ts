import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

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
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    flex: '1 1 0',
    minWidth: 0
  },
  header: { display: 'flex', alignItems: 'center', gap: space.s4, minWidth: 0 },
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
