import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  root: { position: 'relative', display: 'inline-grid', placeItems: 'center' },
  // visibility와 달리 접근 가능한 이름은 남는다.
  hiddenLabel: { opacity: 0, gridArea: '1 / 1' },
  indicator: { gridArea: '1 / 1', display: 'inline-flex', fontSize: '1.25em' }
})
