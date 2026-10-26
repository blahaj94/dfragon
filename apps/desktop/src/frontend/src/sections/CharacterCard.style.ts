import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, space } from '@dfragon/ui/tokens.stylex'

// 이름 수정 중의 네모 점 3개. 한 박자를 셋으로 나눠 차례로 켜고 끊어서 바꾼다(motion.md).
const dotBlink = stylex.keyframes({
  '0%': { opacity: 1 },
  '33.333%, 100%': { opacity: 0.25 }
})

// 숫자 단계(dfragon-design typography.md). 행간은 1이고 자릿수 폭을 고정한다.
const numeric = {
  fontFamily: font.num,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  letterSpacing: 0
} as const

/** 썸네일 한 변의 크기 */
const THUMBNAIL_SIZE = 72
/** 소속, 넷째 줄의 높이. 12px 글자의 행간 14와 같다. */
const LINE_HEIGHT = 14

// 한 줄에 넘치는 글자는 말줄임한다.
const ellipsis = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

export const styles = stylex.create({
  slot: {
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr)',
    // 줄일 수 없는 내용이 있어도 카드가 그리드 칸보다 넓어지지 않게 한다.
    gridTemplateColumns: 'minmax(0, 1fr)',
    minWidth: 0,
    // 후보 창이 카드 자리를 기준으로 겹쳐 뜬다.
    position: 'relative'
  },
  // 왼쪽 썸네일 열과 오른쪽 내용 열. 카드 안 여백은 위 8, 좌우 10, 아래 8이다.
  body: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    flexShrink: 0,
    minWidth: 0,
    paddingTop: space.s8,
    paddingInline: 10,
    paddingBottom: space.s8
  },
  // 썸네일. 카드 위 끝부터 왼쪽 열을 차지한다.
  well: {
    position: 'relative',
    flexShrink: 0,
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    overflow: 'hidden'
  },
  // 접힌 카드는 썸네일을 숨기고 내용 열만 남긴다.
  wellCollapsed: { display: 'none' },
  // 상위, 랭커 카드의 썸네일 아래 2px 단계 색 선. 캐릭터 그림 위에 그리도록 썸네일의 마지막 층에 둔다.
  // 랭커는 썸네일 면도 단계 면이다.
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
  // 오른쪽 열. 이름 칸, 소속, 명성과 점수, 넷째 줄 순서이고 줄 사이는 4다.
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    flex: '1 1 0',
    minWidth: 0
  },
  // 이름 칸, 상태 표시, 스냅샷 칩의 머리 줄
  header: { display: 'flex', alignItems: 'center', gap: space.s4, minWidth: 0 },
  // 이름 칸은 머리 줄의 남는 폭을 채운다. 칸의 테두리 1과 안쪽 여백 4만큼 왼쪽으로 내밀어 이름 글자가
  // 아래 줄 글자와 같은 세로줄에 오게 한다.
  nameField: { display: 'grid', flex: '1 1 0', minWidth: 0, marginInlineStart: -5 },
  dots: { display: 'flex', flexShrink: 0, gap: space.s4, paddingInline: space.s4 },
  dot: {
    width: 4,
    height: 4,
    backgroundColor: colors.cardSignal,
    opacity: { default: 0.25, '@media (prefers-reduced-motion: reduce)': 1 },
    animationName: { default: dotBlink, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.beat,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  },
  // 같은 박자에 묶은 채 시작 위치만 옮겨 둘째, 셋째 점이 차례로 켜진다.
  dotSecond: { animationDelay: `calc(${motion.beat} * -2 / 3)` },
  dotThird: { animationDelay: `calc(${motion.beat} / -3)` },
  // 머리 줄의 상태 표시. 이름 칸과 같은 높이 20이다.
  mark: { display: 'inline-grid', placeItems: 'center', flexShrink: 0, width: 20, height: 20 },
  // 검색 실패 `!` 칸(dfragon-design icons.md, colors.md의 카드 상태와 꺾쇠).
  alert: {
    ...numeric,
    fontSize: 14,
    fontWeight: 700,
    backgroundColor: colors.cardFailureWeak,
    color: colors.cardFailure
  },
  // 소속 줄과 넷째 줄
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    minHeight: LINE_HEIGHT
  },
  lineHidden: { display: 'none' },
  lineDivider: {
    flexShrink: 0,
    width: 1,
    height: 10,
    backgroundColor: colors.cardBorderStrong
  },
  adventure: { ...ellipsis, color: colors.cardFgAdventure },
  // 길드 이름은 유니크 희귀도 색이다(dfragon-design colors.md).
  guild: { ...ellipsis, color: colors.rarityUnique },
  job: { ...ellipsis, flex: '0 1 auto', color: colors.cardFgMuted },
  message: { ...ellipsis, flex: '1 1 0', margin: 0, color: colors.cardFgMuted },
  placeholder: { color: colors.cardBorderStrong },
  // `다시 시도`는 넷째 줄 높이에 맞춘 작은 주 버튼이다. 공용 버튼의 height와 겹치지 않게 최대 높이로 줄인다.
  retry: { maxHeight: 20, paddingLeft: space.s8, paddingRight: 10 },
  // 후보 창을 닫은 뒤 머리 줄에 남는 `후보 4` 칩. 누르면 창을 다시 연다.
  candidateChip: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 20,
    paddingInlineStart: 6,
    paddingInlineEnd: space.s8,
    borderWidth: 0,
    backgroundColor: { default: colors.cardControl, ':hover': colors.cardControlHover },
    boxShadow: `inset 0 0 0 1px ${colors.cardSignal}`,
    color: colors.cardSignal,
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    outline: { default: null, ':focus-visible': `2px solid ${colors.cardSignal}` },
    outlineOffset: { default: null, ':focus-visible': 2 }
  }
})
