import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

// DFragon 디자인 캔버스 메인 보드의 파티 머리: 라벨 12 fg.subtle 위에 값 13 fg.muted, 숫자는 Barlow 20 600.
export const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
    whiteSpace: 'nowrap'
  },
  label: { fontSize: 12, lineHeight: '18px', color: colors.fgSubtle },
  value: { fontSize: 13, lineHeight: 1, color: colors.fgMuted },
  number: {
    fontFamily: font.num,
    fontSize: 20,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
