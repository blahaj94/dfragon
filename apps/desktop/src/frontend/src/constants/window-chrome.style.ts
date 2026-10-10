import * as stylex from '@stylexjs/stylex'

// 메인 창은 상단 바의 끌기 영역으로 창을 옮긴다. Electron 44부터 app-region이 상속되므로
// 끌기 제외는 버튼 묶음 대신 각 버튼을 감싼 요소에 둔다. 묶음에 두면 그 안에 그려지는
// 대화상자 positioner(닫혀 있어도 창 전체 크기)까지 끌기 제외가 되어 끌기 영역이 모두 지워진다.
export const windowChromeStyles = stylex.create({
  noDrag: { display: 'inline-flex', WebkitAppRegion: 'no-drag' }
})
