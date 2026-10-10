import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  // 꺼짐 상태: gray-100 배경에 gray-500 테두리. StyleX 규칙이 SEED recipe보다 우선하므로 배경은
  // 쉬는 상태에만 주고 켜짐, hover, 눌림, 비활성 색은 SEED가 그대로 칠한다. SEED는 꺼짐 테두리를
  // 이 stroke 변수로 그리므로 Control 범위에서만 gray-500을 가리키게 한다.
  control: {
    backgroundColor: {
      default: null,
      ':not([data-checked], [data-indeterminate], [data-disabled], [data-hover], [data-active])':
        'var(--seed-color-palette-gray-100)'
    },
    '--seed-color-stroke-neutral-weak': 'var(--seed-color-palette-gray-500)'
  }
})
