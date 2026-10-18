import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

// 캔버스 카드 면 보드의 기타 면. 머리 24, 행 30에 위쪽 1px 선, 아이템 이름 13 500, 강화와 증폭 Barlow 22 700,
// 마법부여 3점은 6 × 12다. 상세 미리보기의 큰 표는 교차 행 배경을 유지한다.
export const styles = stylex.create({
  table: {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    color: colors.cardFg
  },
  largeTable: { maxWidth: 560, marginInline: 'auto' },
  head: {
    height: 24,
    padding: 0,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: '16px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    color: colors.cardFgSubtle
  },
  // 열 폭은 캔버스의 44, 32에 앞 칸과의 간격 8을 더한 값이다.
  reinforceColumn: { width: 52, paddingInlineStart: space.s8, textAlign: 'right' },
  enchantColumn: { width: 40, paddingInlineStart: space.s8, textAlign: 'right' },
  // 강화와 증폭 범례는 열보다 넓어 캔버스처럼 오른쪽 끝에 맞춘 채 짧은 `장비` 머리 쪽으로 넘친다.
  legendCell: { position: 'relative' },
  legend: {
    position: 'absolute',
    insetBlock: 0,
    right: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10
  },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: space.s4 },
  swatch: { display: 'block', width: 6, height: 6 },
  swatchEnhance: { backgroundColor: colors.gameEnhance },
  swatchAmplify: { backgroundColor: colors.gameAmplify },
  row: {
    height: 30,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardDivider
  },
  largeRow: {
    backgroundColor: { default: colors.cardBg, ':nth-child(even)': colors.cardStripe }
  },
  item: {
    padding: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
    fontWeight: 500,
    lineHeight: '18px',
    textAlign: 'left'
  },
  largeItem: { paddingBlock: space.s4, paddingInline: 6, fontSize: 14, lineHeight: '20px' },
  itemMissing: { color: colors.cardFgSubtle },
  reinforce: {
    paddingBlock: 0,
    paddingInlineEnd: 0,
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: 0,
    whiteSpace: 'nowrap'
  },
  enchant: { paddingBlock: 0, paddingInlineEnd: 0, whiteSpace: 'nowrap' },
  enchantMissing: { fontSize: 13, color: colors.cardBorderStrong },
  dots: { display: 'inline-flex', gap: 2, verticalAlign: 'middle' },
  dot: { width: 6, height: 12 },
  dotEmpty: { backgroundColor: colors.cardBorder }
})

export const reinforceStyles = stylex.create({
  enhance: { color: colors.gameEnhance },
  amplify: { color: colors.gameAmplify },
  missing: { color: colors.cardBorderStrong }
})

export const gradeStyles = stylex.create({
  종결: { backgroundColor: colors.enchantFinal },
  준종결: { backgroundColor: colors.enchantSemi },
  기타: { backgroundColor: colors.enchantOther }
})
