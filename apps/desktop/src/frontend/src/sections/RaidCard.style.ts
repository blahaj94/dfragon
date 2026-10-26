import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

// 이름 수정 중의 네모 점 3개. 파티 카드와 같은 박자다(motion.md).
const dotBlink = stylex.keyframes({
  '0%': { opacity: 1 },
  '33.333%, 100%': { opacity: 0.25 }
})

// 값은 DFragon 디자인 캔버스 공대 보드의 축약 카드다. 안쪽 여백 위 8, 좌우 8, 아래 6에 그림 칸 40과 오른쪽
// 열(이름 칸 20, 소속 줄 14, 명성과 점수 한 줄 14, 줄 사이 4)을 둔다. 글자는 12px 하나이고 행간은 14px다.
export const styles = stylex.create({
  // 자리. 카드 한 장을 담아 끌고 포커스를 받는다. 카드 면이 자리를 채운다.
  seat: {
    position: 'relative',
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr)',
    minWidth: 0,
    cursor: 'default',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2,
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: 'linear'
  },
  movable: { cursor: { default: 'grab', ':active': 'grabbing' } },
  dragSource: { opacity: 0.35 },
  // 끌어 놓을 자리. 카드 면 위에 안쪽 2px 신호색 선을 그려 대기 카드의 점선 외곽선과 함께 보인다.
  dragTarget: {
    '::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      boxShadow: `inset 0 0 0 2px ${colors.cardSignal}`,
      pointerEvents: 'none'
    }
  },
  body: {
    display: 'grid',
    gridTemplateColumns: '40px minmax(0, 1fr)',
    alignItems: 'start',
    gap: space.s8,
    flexShrink: 0,
    minHeight: 0,
    paddingBlockStart: space.s8,
    paddingBlockEnd: 6,
    paddingInline: space.s8
  },
  bodyCollapsed: { gridTemplateColumns: 'minmax(0, 1fr)' },
  well: { position: 'relative', height: 40, overflow: 'hidden' },
  // 상위, 랭커 카드의 그림 칸 아래 2px 단계 색 선. 캐릭터 그림 위에 그린다. 랭커는 그림 칸 면도 단계 면이다.
  wellTop: {
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      bottom: 0,
      height: 2,
      backgroundColor: colors.tierTop
    }
  },
  wellRanker: {
    backgroundColor: colors.tierRankerWell,
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      bottom: 0,
      height: 2,
      backgroundColor: colors.tierRanker
    }
  },
  portrait: { position: 'absolute', inset: 0 },
  progress: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' },
  hidden: { display: 'none' },
  column: { display: 'flex', flexDirection: 'column', gap: space.s4, minWidth: 0 },
  // 이름 칸과 오른쪽 끝의 상태, 스냅샷 순번, 자리 번호. 이름 칸이 남는 폭을 채운다.
  header: { display: 'flex', alignItems: 'center', gap: space.s4, minWidth: 0, height: 20 },
  nameField: { flex: '1 1 0', minWidth: 0 },
  // 자리 번호 칩(12). 오른쪽 위를 자른다.
  number: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 20,
    paddingInlineStart: 6,
    paddingInlineEnd: space.s8,
    fontSize: 12,
    lineHeight: '14px',
    fontVariantNumeric: 'tabular-nums',
    backgroundColor: colors.cardControl,
    color: colors.cardFgMuted,
    transitionProperty: 'background-color, color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  numberSelected: { backgroundColor: colors.cardSignal, color: colors.cardOnSignal },
  numberTop: { backgroundColor: colors.tierTop, color: colors.cardOnSignal },
  numberRanker: { backgroundColor: colors.tierRanker, color: colors.cardOnSignal },
  dots: { display: 'flex', flexShrink: 0, gap: space.s4, paddingInlineEnd: 2 },
  dot: {
    width: 5,
    height: 5,
    backgroundColor: colors.cardSignal,
    opacity: { default: 0.25, '@media (prefers-reduced-motion: reduce)': 1 },
    animationName: { default: dotBlink, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.beat,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  },
  dotSecond: { animationDelay: `calc(${motion.beat} * -2 / 3)` },
  dotThird: { animationDelay: `calc(${motion.beat} / -3)` },
  mark: { display: 'inline-grid', placeItems: 'center', flexShrink: 0, width: 20, height: 20 },
  // 검색 실패 `!` 칸(12).
  alert: {
    fontSize: 12,
    lineHeight: '14px',
    backgroundColor: colors.cardFailureWeak,
    color: colors.cardFailure
  },
  waitingMark: { backgroundColor: colors.cardInset, color: colors.cardFgSubtle },
  // 모험단과 길드. 찾지 못한 카드는 같은 줄에 안내나 흐린 `모험단`을 둔다.
  affiliation: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    height: 14,
    fontSize: 12,
    lineHeight: '14px',
    whiteSpace: 'nowrap'
  },
  adventure: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: colors.cardFgAdventure
  },
  // 길드 이름은 유니크 희귀도 색이다(dfragon-design colors.md).
  guild: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: colors.rarityUnique },
  affiliationDivider: {
    flexShrink: 0,
    width: 1,
    height: 10,
    backgroundColor: colors.cardBorderStrong
  },
  affiliationPlaceholder: { color: colors.cardBorderStrong },
  // 실패, 결과 0건, 입력 안내. 한 줄에 두고 넘치면 줄임표로 끝낸다. 전체 문구는 `title`과 보조 기술에 전한다.
  notice: {
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: colors.cardFgMuted
  }
})
