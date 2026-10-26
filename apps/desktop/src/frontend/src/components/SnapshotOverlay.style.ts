import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  // 카드 전체를 덮되 클릭을 통과시켜 이름 수정, 서버 선택을 막지 않는다.
  layer: { position: 'absolute', inset: 0, pointerEvents: 'none' }
})
