import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

// 숫자 단계(dfragon-design typography.md). 행간은 1이고 자릿수 폭을 고정한다.
const numeric = {
  fontFamily: font.num,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  letterSpacing: 0
} as const

// 캔버스 카드 면 보드의 세트, 서약 섹션. 그림 56, 이름 15 700, 포인트 Barlow 32, 격자 칸 높이 4(넓은 칸 8),
// 묵언의 진의 칸 18 × 8이다.
export const styles = stylex.create({
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s12,
    paddingBlock: space.s16,
    paddingInline: space.s4
  },
  head: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr)',
    alignItems: 'center',
    gap: space.s12
  },
  // 아이템 아이콘은 28px 안팎의 픽셀 그림이라 56으로 키울 때 흐려지지 않게 픽셀을 그대로 키운다.
  image: { width: 56, height: 56, imageRendering: 'pixelated' },
  title: { display: 'flex', flexDirection: 'column', gap: space.s8, minWidth: 0 },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 15,
    fontWeight: 700,
    lineHeight: '20px'
  },
  nameMissing: { fontWeight: 600, color: colors.cardFgSubtle },
  // 칸은 18 폭이 기본이고, 최소 창의 좁은 카드에서는 이름 칸 폭 안에 들도록 함께 줄어든다.
  upgrades: { display: 'flex', gap: space.s8, minWidth: 0 },
  upgradeGroup: { display: 'flex', gap: 2, minWidth: 0 },
  upgradeGroupWidth: (cells: number) => ({ flex: `${cells} 1 ${cells * 20}px` }),
  upgradeCell: { boxSizing: 'border-box', flex: '1 1 18px', minWidth: 0, maxWidth: 18, height: 8 },
  upgradeFilled: { backgroundColor: colors.cardFg },
  upgradeEmpty: { boxShadow: `inset 0 0 0 1px ${colors.cardBorder}` },
  point: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s8,
    paddingTop: space.s8,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardDivider
  },
  pointLabel: { paddingBottom: 3, whiteSpace: 'nowrap', color: colors.cardFgSubtle },
  pointValue: { ...numeric, fontSize: 32, fontWeight: 700, color: colors.cardFg },
  pointMissing: { color: colors.cardBorderStrong },
  rarity: { display: 'flex', flexDirection: 'column', gap: space.s8 },
  grid: { display: 'flex', alignItems: 'flex-end', gap: 6 },
  group: { display: 'flex', alignItems: 'flex-end', gap: 2, minWidth: 0 },
  // 무기와 서약 본체는 칸 2.5개 폭이고, 나머지 묶음은 칸 수만큼 폭을 나눈다.
  groupMain: { flex: 2.5 },
  groupWidth: (cells: number) => ({ flex: cells }),
  cell: { flex: 1, minWidth: 0, height: 4 },
  cellMain: { height: 8 },
  cellEmpty: { boxShadow: `inset 0 0 0 1px ${colors.cardBorder}` },
  counts: { display: 'flex', flexWrap: 'wrap', columnGap: space.s16, rowGap: space.s4 },
  count: { display: 'flex', alignItems: 'baseline', gap: space.s4 },
  countLabel: { color: colors.cardFgSubtle },
  countValue: { ...numeric, fontSize: 20, fontWeight: 700 }
})
