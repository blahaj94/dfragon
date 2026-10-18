import * as stylex from '@stylexjs/stylex'
import { colors, size, space } from '@dfragon/ui/tokens.stylex'

// 카드 꺾쇠의 호버 움직임(4px)이 스크롤 영역 가장자리에서 잘리지 않도록 영역을 그만큼 넓히고 안쪽을 비운다.
const BRACKET_ROOM = 4
// 스크롤 막대 두께. 세로 막대는 오른쪽 콘텐츠 여백 24 안에 두어 기준 창에서 카드가 파티 화면과 같은
// 자리에 놓이게 한다.
const SCROLLBAR_SIZE = 8
// 공대 카드는 창 크기와 상관없이 기준 창 1280×800의 파티 카드 크기로 고정한다. 폭은 콘텐츠 폭
// 1232(1280 - 여백 24×2)에서 거터 16×3을 뺀 4등분, 높이는 800에서 상단 바 56, 여백 24×2, 머리 48과
// 간격 16을 뺀 값이다.
const CARD_WIDTH = 296
const CARD_HEIGHT = 632

// dfragon-design에 공대 보드가 없어 배치는 작업자가 정했다. 파티 화면처럼 높이 48의 머리 아래 16을 두고,
// 네 장을 한 파티로 세 줄 쌓는다. 머리는 고정하고 카드 영역만 스크롤한다. 카드가 296×632로 고정이라
// 창이 기준보다 좁거나 낮으면 카드 영역이 가로와 세로로 스크롤한다. 접은 동안 줄은 고정 폭 카드의 접힌
// 내용 높이만 차지한다. 줄 사이와 카드 사이는 거터 16이다.
export const styles = stylex.create({
  page: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s16,
    minHeight: size.controlLg
  },
  title: { display: 'flex', alignItems: 'baseline', gap: space.s12, minWidth: 0 },
  // 파티 머리처럼 접기, 마지막 캡처, 캡처 버튼을 16 간격으로 둔다.
  actions: { display: 'flex', alignItems: 'center', gap: space.s16, flexShrink: 0 },
  status: { color: colors.fgMuted, minWidth: 0, overflowWrap: 'anywhere' },
  parties: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16,
    overflow: 'auto',
    marginBlock: -BRACKET_ROOM,
    marginInlineStart: -BRACKET_ROOM,
    marginInlineEnd: `calc(-1 * ${space.s24})`,
    paddingBlock: BRACKET_ROOM,
    paddingInlineStart: BRACKET_ROOM,
    paddingInlineEnd: `calc(${space.s24} - ${SCROLLBAR_SIZE}px)`,
    '::-webkit-scrollbar': { width: SCROLLBAR_SIZE, height: SCROLLBAR_SIZE },
    '::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-thumb': { backgroundColor: colors.borderStrong }
  },
  party: {
    display: 'grid',
    gridTemplateColumns: `repeat(4, ${CARD_WIDTH}px)`,
    gridTemplateRows: `${CARD_HEIGHT}px`,
    flexShrink: 0,
    // 카드 영역이 좁아도 줄이 카드 네 장의 폭을 그대로 차지해 가로 스크롤 범위가 된다.
    width: 'max-content',
    gap: space.s16
  },
  partyCollapsed: { gridTemplateRows: 'auto', alignItems: 'start' }
})
