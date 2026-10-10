import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  // SEED outline 입력은 포커스 선을 이 stroke 변수로 그린다. 디자인 포커스 색인 focus ring으로 바꾼다.
  root: { '--seed-color-stroke-neutral-contrast': 'var(--seed-color-stroke-focus-ring)' }
})
