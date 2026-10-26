import * as stylex from '@stylexjs/stylex'

// 상단 바 머리의 캡처 주 버튼은 높이 28이다. 공용 Button sm(32)의 height와 같은 속성을 다시 주면 어느
// class가 이길지 StyleX 산출 순서에 달려 있으므로 maxHeight로 줄이고, 아이콘과 글자 사이는 6으로 둔다.
export const styles = stylex.create({
  button: { maxHeight: 28, columnGap: 6 }
})
