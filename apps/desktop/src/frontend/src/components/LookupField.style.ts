import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  field: { flex: '1 1 0', minWidth: 0 },
  // 칸의 테두리 1과 안쪽 여백 4만큼 왼쪽으로 내밀어 이름 글자가 아래 줄 글자와 같은 세로줄에 오게 한다.
  party: { display: 'grid', marginInlineStart: -5 }
})
