import * as stylex from '@stylexjs/stylex'

// 파티 머리의 캡처 주 버튼과 같은 값이다. Button lg의 좌우 여백 24를 캔버스의 왼쪽 14, 오른쪽 18로 맞추고
// 아이콘, 구분선, 키캡 사이를 14로 둔다.
export const styles = stylex.create({
  content: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 14,
    marginInlineStart: -10,
    marginInlineEnd: -6
  },
  // 구분선은 버튼 글자색의 30%라 비활성 버튼에서도 함께 흐려진다.
  divider: {
    width: 1.5,
    height: 24,
    flexShrink: 0,
    backgroundColor: 'color-mix(in srgb, currentColor 30%, transparent)'
  },
  keys: { display: 'inline-flex', gap: 4 }
})
