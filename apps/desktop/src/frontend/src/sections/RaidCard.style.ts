import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

// 이름 칸이 한글 여섯 자와 서버 선택을 담는 148, 자리 번호 26, 간격 둘 8을 먼저 남기고 직업은 나머지 폭에만
// 그린다. 직업이 길거나 창이 좁아도 이름이 가려지지 않게 하려는 값이다.
const NAME_FIRST_ROOM = 182

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
  job: {
    flex: '0 1 auto',
    minWidth: 0,
    maxWidth: `calc(100% - ${NAME_FIRST_ROOM}px)`,
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
