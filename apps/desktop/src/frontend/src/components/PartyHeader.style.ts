import * as stylex from '@stylexjs/stylex'
import { colors, font, size, space } from '@dfragon/ui/tokens.stylex'

// dfragon-design layout.md의 파티 머리는 높이 48이고 카드와 16 떨어진다. 배치와 글자 크기는 DFragon
// 디자인 캔버스 메인 보드의 파티 머리를 따른다.
export const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s16,
    minHeight: size.controlLg
  },
  title: { display: 'flex', alignItems: 'baseline', gap: space.s12, minWidth: 0 },
  heading: { flexShrink: 0, letterSpacing: '-0.01em' },
  count: {
    flexShrink: 0,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 28,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  total: { color: colors.fgSubtle },
  notice: {
    minWidth: 0,
    color: colors.fgMuted,
    fontSize: 13,
    lineHeight: '18px',
    overflowWrap: 'anywhere'
  },
  actions: { display: 'flex', alignItems: 'center', gap: space.s16, flexShrink: 0 },
  // Button lg의 좌우 여백 24를 캔버스의 왼쪽 14, 오른쪽 18로 맞추고 아이콘, 구분선, 키캡 사이를 14로 둔다.
  capture: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 14,
    marginInlineStart: -10,
    marginInlineEnd: -6
  },
  // 구분선은 버튼 글자색의 30%라 비활성 버튼에서도 함께 흐려진다.
  captureDivider: {
    width: 1.5,
    height: 24,
    flexShrink: 0,
    backgroundColor: 'color-mix(in srgb, currentColor 30%, transparent)'
  },
  keys: { display: 'inline-flex', gap: 4 }
})
