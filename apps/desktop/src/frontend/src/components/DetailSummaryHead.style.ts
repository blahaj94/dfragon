import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

// DFragon 디자인 캔버스 상세 창 보드의 세트, 서약 머리. 그림 32, 이름 13 700, 포인트 Barlow 22 700이고, 묵언의
// 진의 칸 18 × 8은 그림 폭과 간격만큼 들여 이름 아래에 둔다.
export const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  head: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0
  },
  image: { width: 32, height: 32, overflow: 'hidden' },
  name: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: '18px'
  },
  nameMissing: { color: colors.cardFgMuted },
  point: {
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 22,
    fontWeight: 700,
    lineHeight: '22px',
    color: colors.cardFg
  },
  pointMissing: { color: colors.cardBorderStrong },
  upgradeSpace: { height: 8 },
  upgrades: { display: 'flex', gap: space.s8, height: 8, marginLeft: 40 },
  upgradeGroup: { display: 'flex', gap: 2 },
  upgradeCell: {
    display: 'block',
    width: 18,
    height: 8,
    boxSizing: 'border-box',
    outline: { default: 'none', ':focus-visible': `2px solid ${colors.cardSignal}` },
    outlineOffset: 1
  },
  upgradeFilled: { backgroundColor: colors.cardFg },
  upgradeEmpty: { boxShadow: `inset 0 0 0 1px ${colors.cardBorder}` },
  upgradeTip: {
    backgroundColor: colors.cardInset,
    boxShadow: `inset 0 0 0 1px ${colors.cardBorderStrong}`,
    color: colors.cardFg,
    whiteSpace: 'nowrap'
  }
})
