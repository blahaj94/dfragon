import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  // SEED medium iconOnly의 좌우 여백 10에 24 아이콘을 넣으면 폭이 44가 되므로,
  // 디자인 IconButton의 40 정사각형에 맞춰 여백만 줄인다.
  square: { padding: 8 }
})
