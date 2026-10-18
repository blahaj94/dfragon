import * as stylex from '@stylexjs/stylex'
import { colors, font, radius } from './tokens.stylex'

// 키캡은 typography.md numeric.key(Barlow Condensed 14 700)와 캔버스의 22px 상자를 따른다.
// 컨트롤 높이 단계 밖의 값이라 토큰 없이 둔다.
export const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    minWidth: 22,
    height: 22,
    paddingInline: 5,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 14,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  // 신호색 주 버튼 안의 키캡은 버튼 글자색을 따르고 외곽은 그 색의 55%다. 버튼이 비활성으로 바뀌어도
  // 글자색을 따라 함께 흐려진다.
  signal: {
    borderColor: 'color-mix(in srgb, currentColor 55%, transparent)',
    color: 'inherit'
  }
})
