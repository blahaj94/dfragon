import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  root: { position: 'relative', display: 'inline-grid', placeItems: 'center' },
  // 글자는 투명하게 자리만 지켜 버튼 폭이 바뀌지 않게 한다. visibility와 달리 접근 가능한 이름은 남는다.
  hiddenLabel: { opacity: 0, gridArea: '1 / 1' },
  indicator: { gridArea: '1 / 1', display: 'inline-flex', fontSize: '1.25em' }
})
