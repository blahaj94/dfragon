import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 칩을 감싼 버튼은 면을 두지 않고, 포커스 선은 칩의 자른 모서리에 가리지 않도록 바깥 2px에 그린다.
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
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.s8,
    fontSize: 12,
    lineHeight: '14px'
  }
})
