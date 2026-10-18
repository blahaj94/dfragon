import * as stylex from '@stylexjs/stylex'
import { colors, size, space } from '@dfragon/ui/tokens.stylex'

// 카드 꺾쇠의 호버 움직임(4px)이 스크롤 영역 가장자리에서 잘리지 않도록 영역을 그만큼 넓히고 안쪽을 비운다.
const BRACKET_ROOM = 4
// 세로 스크롤 막대 폭. 오른쪽 콘텐츠 여백 24 안에 막대를 두어 카드 폭이 파티 화면과 같게 한다.
const SCROLLBAR_WIDTH = 8

// dfragon-design에 공대 보드가 없어 배치는 작업자가 정했다. 파티 화면처럼 높이 48의 머리 아래 16을 두고,
// 12열 그리드의 3열씩 네 장을 한 파티로 세 줄 쌓는다. 머리는 고정하고 카드 영역만 세로로 스크롤한다.
// 펼친 동안 한 파티 줄은 스크롤 영역의 높이와 같아 카드가 파티 화면의 카드와 같은 크기가 되고, 접은
// 동안은 카드 내용 높이만 차지한다. 줄 사이는 거터 16이다.
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
  status: { color: colors.fgMuted, minWidth: 0, overflowWrap: 'anywhere' },
  parties: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16,
    overflowY: 'auto',
    containerType: 'size',
    marginBlock: -BRACKET_ROOM,
    marginInlineStart: -BRACKET_ROOM,
    marginInlineEnd: `calc(-1 * ${space.s24})`,
    paddingBlock: BRACKET_ROOM,
    paddingInlineStart: BRACKET_ROOM,
    paddingInlineEnd: `calc(${space.s24} - ${SCROLLBAR_WIDTH}px)`,
    '::-webkit-scrollbar': { width: SCROLLBAR_WIDTH },
    '::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-thumb': { backgroundColor: colors.borderStrong }
  },
  party: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gridTemplateRows: 'minmax(0, 1fr)',
    flexShrink: 0,
    height: '100cqh',
    gap: space.s16
  },
  partyCollapsed: { height: 'auto', alignItems: 'start' }
})
