import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 카드 꺾쇠의 호버 움직임과 자리 포커스 선(바깥 4px)이 스크롤 영역 가장자리에서 잘리지 않도록 영역을 그만큼
// 넓히고 안쪽을 비운다.
const EDGE_ROOM = 4
// 스크롤 막대 두께. 세로 막대 자리를 늘 비워 두어 막대가 생겨도 카드 폭이 바뀌지 않고 오른쪽 여백이 16으로 같다.
const SCROLLBAR_SIZE = 8

export const styles = stylex.create({
  page: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s12
  },
  // 머리는 고정하고 보드만 스크롤한다. 창이 낮아 넘치면 보드 영역이 세로로 스크롤한다. 세로 막대는
  // 콘텐츠 영역의 오른쪽 여백(App.style.ts `content`의 좌우 16) 안에 둔다. 여백보다 더 튀어나오면 콘텐츠
  // 영역에 가로 스크롤이 생긴다.
  scroller: {
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'auto',
    scrollbarGutter: 'stable',
    marginBlock: -EDGE_ROOM,
    marginInlineStart: -EDGE_ROOM,
    marginInlineEnd: `calc(-1 * ${space.s16})`,
    paddingBlock: EDGE_ROOM,
    paddingInlineStart: EDGE_ROOM,
    paddingInlineEnd: `calc(${space.s16} - ${SCROLLBAR_SIZE}px)`,
    '::-webkit-scrollbar': { width: SCROLLBAR_SIZE, height: SCROLLBAR_SIZE },
    '::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-thumb': { backgroundColor: colors.borderStrong }
  },
  // DFragon 디자인 캔버스 공대 보드의 배치. 카드 네 열을 간격 8로 두고 폭은 창 폭을 네 등분하며, 높이는 카드
  // 내용이 정한다. 카드 네 장이 한 줄을 채우므로 순서대로 놓으면 줄마다 한 파티가 된다. 카드는 모두 같은 부모 아래에 두어
  // 다른 파티와 맞바꿔도 카드의 입력 초안과 포커스가 그대로 옮겨 간다.
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: space.s8
  }
})
