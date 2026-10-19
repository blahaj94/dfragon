import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, space } from '@dfragon/ui/tokens.stylex'

// 행 머리 칸 다음부터 스킬 칸이다. 행의 grid 열 1이 머리, 2부터 12까지가 스킬 열 0부터 10이다.
const FIRST_SKILL_GRID_COLUMN = 2
// 보드의 행 면 #17171A, #1A1A1D. 두 번째 면은 카드 면과 안쪽 면의 중간이다.
const altRowBg = `color-mix(in srgb, ${colors.cardBg}, ${colors.cardInset})`
// 보드의 미습득 레벨 숫자 #5C5953. 흐린 글자색을 카드 면 쪽으로 낮춘다.
const offLevel = `color-mix(in srgb, ${colors.cardFgSubtle} 60%, ${colors.cardBg})`

// DFragon 디자인 캔버스 상세 창 보드의 스킬트리. 행은 28px 머리와 11개 38px 열, 열 간격 4이고 칸은 38 × 48에
// 28px 아이콘과 레벨 숫자다. 설명 상자는 폭 256, 위 2px 크림 선과 오른쪽 위 잘린 모서리다.
export const styles = stylex.create({
  tree: { display: 'flex', flexDirection: 'column' },
  row: {
    display: 'grid',
    gridTemplateColumns: '28px repeat(11, 38px)',
    columnGap: space.s4,
    alignItems: 'center',
    margin: 0,
    paddingBlock: 3,
    paddingInline: 0,
    listStyle: 'none',
    backgroundColor: { default: colors.cardBg, ':nth-child(even)': altRowBg }
  },
  rowLabel: {
    gridColumn: 1,
    gridRow: 1,
    paddingLeft: space.s4,
    fontFamily: font.num,
    fontSize: 13,
    fontWeight: 600,
    color: colors.cardFgSubtle
  },
  cell: {
    position: 'relative',
    gridRow: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    width: 38,
    height: 48,
    boxSizing: 'border-box',
    paddingTop: space.s4,
    backgroundColor: colors.bgWell,
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.cardBorder}`,
      ':is(:hover, [data-popup-open])': `inset 0 0 0 1px ${colors.cardSignal}`,
      ':focus-visible': `inset 0 0 0 2px ${colors.cardSignal}`
    },
    outline: 'none',
    cursor: 'default',
    transitionProperty: 'box-shadow',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  cellAt: (column: number) => ({ gridColumn: String(column + FIRST_SKILL_GRID_COLUMN) }),
  // 각성기는 크림 1px 테두리와 아래에서 올라오는 옅은 크림 면이다.
  awakening: {
    backgroundImage: `linear-gradient(to top, color-mix(in srgb, ${colors.cardSignal} 18%, transparent), transparent 70%)`,
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.cardSignal}`,
      ':focus-visible': `inset 0 0 0 2px ${colors.cardSignal}`
    }
  },
  icon: { display: 'block', width: 28, height: 28, flexShrink: 0 },
  // 아이콘을 뽑지 못한 스킬은 같은 크기의 빈 칸으로 자리를 지킨다.
  iconMissing: { backgroundColor: colors.cardInset },
  // 익히지 않은 스킬은 아이콘을 흐린 흑백으로 그린다.
  iconOff: { opacity: 0.3, filter: 'grayscale(1)' },
  level: {
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: '14px',
    color: colors.cardFg
  },
  levelOff: { color: offLevel },
  levelAwakening: { color: colors.cardSignal },
  tip: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s8,
    width: 256,
    boxSizing: 'border-box',
    padding: space.s12,
    backgroundColor: colors.cardInset,
    borderTopWidth: 2,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardSignal,
    boxShadow: `0 0 0 1px ${colors.cardBorderStrong}, 0 12px 32px rgb(0 0 0 / 60%)`,
    color: colors.cardFg,
    fontSize: 12,
    lineHeight: '18px',
    textAlign: 'left'
  },
  tipHead: { display: 'flex', alignItems: 'center', gap: space.s8 },
  tipName: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px',
    color: colors.cardFg
  },
  tipLevel: {
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 24,
    fontWeight: 700,
    lineHeight: '24px',
    color: colors.cardFg
  },
  tipKind: { color: colors.cardFgSubtle },
  // 설명은 원문 줄바꿈을 지킨다.
  tipText: {
    display: 'block',
    whiteSpace: 'pre-line',
    overflowWrap: 'anywhere',
    color: colors.cardFgMuted
  },
  vpChips: { display: 'flex', flexWrap: 'wrap', gap: space.s4 },
  vpChip: {
    display: 'flex',
    alignItems: 'center',
    height: 22,
    paddingInline: space.s8,
    backgroundColor: colors.cardControl,
    borderRadius: 2,
    color: colors.cardFgMuted
  },
  vpChipSelected: { color: colors.cardSignal }
})
