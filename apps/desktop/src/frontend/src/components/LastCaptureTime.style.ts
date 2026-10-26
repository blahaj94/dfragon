import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

// 축소 시안 상단 바 머리: `마지막 캡처 12초 전`을 높이 28 한 줄에 둔다. 라벨은 fg.subtle, 값은 fg.muted인
// 12px이고 초, 분 숫자만 Barlow Condensed로 쓴다. 라벨과 값은 한 줄 안에서 글자 기준선을 맞춘다.
export const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    height: 28,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '14px'
  },
  label: { marginInlineEnd: 6, color: colors.fgSubtle },
  value: { color: colors.fgMuted },
  number: {
    fontFamily: font.num,
    fontSize: 14,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
