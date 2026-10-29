import * as stylex from '@stylexjs/stylex'

// 상단 바 헤더의 캡처 주 버튼은 높이 28, 좌우 여백 10이다. 공용 Button sm(32, 여백 12)의 height, paddingInline과
// 같은 속성을 다시 주면 어느 class가 이길지 StyleX 산출 순서에 달려 있으므로 maxHeight와 좌우 개별 여백으로 줄인다.
export const styles = stylex.create({
  button: { maxHeight: 28, paddingLeft: 10, paddingRight: 10 }
})
