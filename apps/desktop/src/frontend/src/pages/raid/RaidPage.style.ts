import * as stylex from '@stylexjs/stylex'
import { colors, font, size, space } from '@dfragon/ui/tokens.stylex'

// 카드 꺾쇠의 호버 움직임과 자리 포커스 선(바깥 4px)이 스크롤 영역 가장자리에서 잘리지 않도록 영역을 그만큼
// 넓히고 안쪽을 비운다.
const EDGE_ROOM = 4
// 스크롤 막대 두께. 세로 막대는 오른쪽 콘텐츠 여백 24 안에 두어 기준 창에서 카드가 보드 자리에 놓이게 한다.
const SCROLLBAR_SIZE = 8
// DFragon 디자인 캔버스 공대 보드의 1280×800 배치. 콘텐츠 위 여백 20, 머리 48, 간격 12 아래에 32 폭 파티
// 라벨 열과 카드 네 열, 세 줄을 거터 12로 둔다. 카드는 창 크기와 상관없이 이 크기로 고정한다. 폭은 콘텐츠 폭
// 1232(1280 - 24×2)에서 라벨 열 32와 거터 12×4를 뺀 4등분, 높이는 800에서 상단 바 56, 위아래 여백 20과
// 24, 머리 48, 간격 12, 줄 사이 12×2를 뺀 616의 3등분이다. 접힌 카드는 접은 창 560에서 같은 계산이다.
const PARTY_LABEL_WIDTH = '32px'
const CARD_WIDTH = '288px'
const CARD_HEIGHT = 'calc(616px / 3)'
const COLLAPSED_CARD_HEIGHT = 'calc(376px / 3)'

export const styles = stylex.create({
  page: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s12,
    // 콘텐츠 영역의 위 여백 24를 보드의 20으로 줄인다.
    marginTop: -4
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s16,
    minHeight: size.controlLg,
    flexShrink: 0
  },
  title: { display: 'flex', alignItems: 'baseline', gap: space.s12, minWidth: 0 },
  heading: { flexShrink: 0, letterSpacing: '-0.01em' },
  // 캐릭터를 찾은 자리 수(Barlow Condensed 28 700). 분모는 흐린 글자다.
  count: {
    flexShrink: 0,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 28,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  // 스냅샷 회차 번호(`#2`). 인원수와 같은 28px이고 `#`도 줄이지 않는다. 색은 신호색이라 다크는 크림이다.
  round: {
    flexShrink: 0,
    color: colors.signal,
    fontFamily: font.num,
    fontSize: 28,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  total: { color: colors.fgSubtle },
  notice: {
    minWidth: 0,
    color: colors.fgMuted,
    fontSize: 13,
    lineHeight: '18px',
    overflowWrap: 'anywhere'
  },
  // 파티 머리처럼 접기, 마지막 캡처, 스냅샷, 캡처 버튼을 16 간격으로 둔다.
  actions: { display: 'flex', alignItems: 'center', gap: space.s16, flexShrink: 0 },
  // 머리는 고정하고 보드만 스크롤한다. 창이 기준보다 좁거나 낮으면 가로와 세로로 스크롤한다.
  scroller: {
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'auto',
    marginBlock: -EDGE_ROOM,
    marginInlineStart: -EDGE_ROOM,
    marginInlineEnd: `calc(-1 * ${space.s24})`,
    paddingBlock: EDGE_ROOM,
    paddingInlineStart: EDGE_ROOM,
    paddingInlineEnd: `calc(${space.s24} - ${SCROLLBAR_SIZE}px)`,
    '::-webkit-scrollbar': { width: SCROLLBAR_SIZE, height: SCROLLBAR_SIZE },
    '::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
    '::-webkit-scrollbar-thumb': { backgroundColor: colors.borderStrong }
  },
  // 라벨 하나와 카드 네 장이 한 줄을 채우므로 순서대로 놓으면 줄마다 한 파티가 된다. 카드는 모두 같은
  // 부모 아래에 두어 다른 파티와 맞바꿔도 카드의 입력 초안과 포커스가 그대로 옮겨 간다.
  board: {
    display: 'grid',
    gridTemplateColumns: `${PARTY_LABEL_WIDTH} repeat(4, ${CARD_WIDTH})`,
    gridTemplateRows: `repeat(3, ${CARD_HEIGHT})`,
    gap: space.s12,
    width: 'max-content'
  },
  boardCollapsed: { gridTemplateRows: `repeat(3, ${COLLAPSED_CARD_HEIGHT})` },
  // 파티 라벨. 숫자는 Barlow Condensed 28 700, 아래 `파티`는 11이고 오른쪽에 2px 선을 둔다.
  partyLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRightWidth: 2,
    borderRightStyle: 'solid',
    borderRightColor: colors.borderDefault
  },
  partyNumber: {
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 28,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: '28px'
  },
  partyName: { color: colors.fgSubtle, fontSize: 11, lineHeight: '14px' }
})
