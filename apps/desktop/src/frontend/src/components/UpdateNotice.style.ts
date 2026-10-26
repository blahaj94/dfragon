import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 칩을 감싼 버튼은 면을 두지 않고, 포커스 선은 칩의 자른 모서리에 가리지 않도록 바깥 2px에 그린다.
// 게임 연결 상태 칩의 버튼과 같은 모양이다.
export const styles = stylex.create({
  trigger: {
    display: 'inline-flex',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  },
  // 공용 메뉴 항목은 14px이지만 축소 시안의 한글은 12px, 행간 14px 하나로 쓴다.
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.s8,
    fontSize: 12,
    lineHeight: '14px'
  }
})
