import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, radius, size, space } from '@dfragon/ui/tokens.stylex'

// 이름 수정 중의 네모 점 3개. 한 박자를 셋으로 나눠 차례로 켜고 끊어서 바꾼다(motion.md).
const dotBlink = stylex.keyframes({
  '0%': { opacity: 1 },
  '33.333%, 100%': { opacity: 0.25 }
})

// 접힌 카드에서 칸보다 긴 소속과 이름은 일정한 속도로 3초 동안 끝까지 흐르고 1초 쉰 뒤 3초 동안 돌아와
// 1초 쉰다. 이동 거리는 글자 폭에서 감싼 칸(container) 폭을 뺀 만큼이라 칸에 들어가면 움직이지 않는다.
const marquee = stylex.keyframes({
  '0%': { transform: 'translateX(0)' },
  '37.5%, 50%': { transform: 'translateX(min(0px, calc(100cqw - 100%)))' },
  '87.5%, 100%': { transform: 'translateX(0)' }
})

// 접을 때 사라지는 부분은 높이를 상태 전환 시간에 줄이고, 불투명도는 motion.md의 예외대로 120ms
// 직선으로 줄인다. visibility도 같은 시간 뒤 숨겨 접힌 동안 포커스와 보조 기술에서 빠진다.
const collapseTransition = {
  transitionProperty: 'max-height, opacity, visibility',
  transitionDuration: `${motion.durState}, ${motion.durHover}, ${motion.durHover}`,
  transitionTimingFunction: `${motion.ease}, linear, linear`
} as const

// 숫자 단계(dfragon-design typography.md). 행간은 1이고 자릿수 폭을 고정한다.
const numeric = {
  fontFamily: font.num,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  letterSpacing: 0
} as const

export const styles = stylex.create({
  // 그리드 칸을 채우는 자리. 카드는 펼친 동안 파티 영역 높이를 채운다.
  slot: {
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr)',
    // 접힌 카드의 후보 타일처럼 줄일 수 없는 내용이 있어도 카드가 그리드 칸보다 넓어지지 않게 한다.
    gridTemplateColumns: 'minmax(0, 1fr)',
    minWidth: 0
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    height: 48,
    flexShrink: 0,
    minWidth: 0,
    paddingInline: space.s12,
    containerType: 'inline-size'
  },
  // 카드 번호 칩(numeric.chip 16 700). 오른쪽 위를 자른다.
  number: {
    ...numeric,
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 24,
    paddingInlineStart: space.s8,
    paddingInlineEnd: 10,
    fontSize: 16,
    fontWeight: 700,
    backgroundColor: colors.cardControl,
    color: colors.cardFgMuted,
    transitionProperty: 'background-color, color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  numberSelected: { backgroundColor: colors.cardSignal, color: colors.cardOnSignal },
  numberWaiting: { backgroundColor: colors.cardInset, color: colors.cardFgSubtle },
  // 상위, 랭커 카드의 번호 칩은 단계 색 면이다(dfragon-design colors.md의 카드 상태와 꺾쇠).
  numberTop: { backgroundColor: colors.tierTop, color: colors.cardOnSignal },
  numberRanker: { backgroundColor: colors.tierRanker, color: colors.cardOnSignal },
  server: { display: 'flex', flexShrink: 0, minWidth: 0, maxWidth: '50%' },
  spacer: { flex: 1, minWidth: 0 },
  dots: { display: 'flex', flexShrink: 0, gap: space.s4, paddingInlineEnd: space.s4 },
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
  // 같은 박자에 묶은 채 시작 위치만 옮겨 둘째, 셋째 점이 차례로 켜진다.
  dotSecond: { animationDelay: `calc(${motion.beat} * -2 / 3)` },
  dotThird: { animationDelay: `calc(${motion.beat} / -3)` },
  mark: { display: 'inline-grid', placeItems: 'center', flexShrink: 0, width: 24, height: 24 },
  // 검색 실패 `!` 칸(dfragon-design icons.md, colors.md의 카드 상태와 꺾쇠).
  alert: {
    ...numeric,
    fontSize: 18,
    fontWeight: 700,
    backgroundColor: colors.cardFailureWeak,
    color: colors.cardFailure
  },
  waitingMark: { backgroundColor: colors.cardInset, color: colors.cardFgSubtle },
  body: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 },
  characterFace: { display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0 },
  // 그림 칸. 펼친 창에서는 280이고 창이 낮으면 먼저 줄어든다.
  well: {
    position: 'relative',
    flex: '0 1 auto',
    height: 280,
    minHeight: 96,
    marginInline: space.s12,
    overflow: 'hidden',
    transitionProperty: 'height, min-height, opacity, visibility',
    transitionDuration: `${motion.durState}, ${motion.durState}, ${motion.durHover}, ${motion.durHover}`,
    transitionTimingFunction: `${motion.ease}, ${motion.ease}, linear, linear`
  },
  wellCollapsed: { height: 0, minHeight: 0, opacity: 0, visibility: 'hidden' },
  // 상위, 랭커 카드의 그림 칸 아래 2px 단계 색 선. 캐릭터 그림 위에 그리도록 그림 칸의 마지막 층에 둔다.
  // 랭커는 그림 칸 면도 단계 면이다.
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
  topNotice: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    margin: 0,
    paddingBlock: space.s4,
    paddingInline: space.s8,
    textAlign: 'center',
    backgroundColor: colors.cardInset,
    color: colors.cardFgMuted
  },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s12,
    padding: space.s16
  },
  message: { margin: 0, textAlign: 'center', color: colors.cardFgMuted },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minWidth: 0,
    paddingTop: space.s16,
    paddingInline: space.s16,
    paddingBottom: space.s12
  },
  identityRow: { display: 'flex', alignItems: 'center', gap: space.s8, minWidth: 0 },
  identityText: { display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 },
  affiliation: { display: 'flex', alignItems: 'center', gap: space.s8, minWidth: 0, height: 18 },
  adventure: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.cardFgAdventure
  },
  // 길드 이름은 유니크 희귀도 색이다(dfragon-design colors.md).
  guild: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.rarityUnique
  },
  affiliationDivider: {
    flexShrink: 0,
    width: 1,
    height: 10,
    backgroundColor: colors.cardBorderStrong
  },
  affiliationPlaceholder: { color: colors.cardBorderStrong },
  // 직업은 캔버스 카드 면 보드처럼 소속 줄 오른쪽 끝에 두고, 접힌 동안 숨긴다.
  job: {
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.cardFgMuted,
    transitionProperty: 'opacity, visibility',
    transitionDuration: `${motion.durHover}, ${motion.durHover}`,
    transitionTimingFunction: 'linear'
  },
  jobHidden: { opacity: 0, visibility: 'hidden' },
  marqueeBox: { flex: '1 1 0', minWidth: 0, overflow: 'hidden', containerType: 'inline-size' },
  marqueeText: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.s8,
    width: 'max-content',
    whiteSpace: 'nowrap',
    animationName: { default: marquee, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: '8s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite'
  },
  // 접힌 카드의 이름 칸 위에 흐르는 이름을 겹쳐 그린다. 누르면 아래 입력 칸이 포커스를 받는다. 좌우 10은
  // 아래 `name`의 테두리 2와 안쪽 여백 8을 더한 값이라, 둘이 바뀌면 함께 맞춘다.
  nameMarquee: {
    position: 'absolute',
    insetBlock: 0,
    insetInline: 10,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    containerType: 'inline-size',
    pointerEvents: 'none',
    color: colors.cardFg
  },
  nameUnderMarquee: { color: 'transparent' },
  // 이름은 평소 테두리 없는 글자로 보이고, 고치는 동안 카드 신호색 상자가 된다. 글자가 모험단과 같은
  // 세로줄에 오도록 상자 안쪽 여백과 테두리만큼 왼쪽으로 내민다.
  // Typo가 요소 margin을 0으로 두므로 내미는 여백은 감싼 상자에 준다.
  nameBox: {
    position: 'relative',
    minWidth: 0,
    marginTop: 3,
    marginBottom: -1,
    marginInlineStart: -10
  },
  name: {
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    height: size.controlSm,
    paddingBlock: 0,
    paddingInline: space.s8,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: { default: 'transparent', ':hover:not(:disabled)': colors.cardBorder },
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    color: { default: colors.cardFg, ':disabled': colors.cardFgMuted },
    fontFamily: 'inherit',
    outlineStyle: 'none',
    transitionProperty: 'border-color, background-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease,
    '::placeholder': { color: colors.cardFgSubtle }
  },
  nameWaiting: { borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.bgWell },
  nameFailure: { borderColor: colors.cardFailure },
  nameSelected: { borderWidth: 2, borderColor: colors.cardSignal, backgroundColor: colors.bgWell },
  collapsible: {
    ...collapseTransition,
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    maxHeight: 80,
    paddingTop: space.s4,
    overflow: 'hidden'
  },
  collapsibleHidden: { maxHeight: 0, paddingTop: 0, opacity: 0, visibility: 'hidden' },
  hint: { color: colors.cardFgSubtle },
  // 명성과 점수. 라벨은 왼쪽 12px, 값은 오른쪽에 같은 크기로 두 층 쌓는다. 남는 높이는 이 위에 둔다.
  stats: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    margin: 0,
    marginTop: 'auto',
    paddingBlock: space.s8,
    paddingInline: space.s16,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardBorder
  },
  statsVacant: { borderTopStyle: 'dashed' },
  statsRanker: { borderTopColor: colors.tierRankerOutline },
  statRow: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s8,
    height: 40,
    paddingBottom: space.s4
  },
  statRowDivided: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardDivider
  },
  statRowDividedVacant: { borderTopColor: colors.cardInset },
  statLabel: { margin: 0, paddingBottom: 3, whiteSpace: 'nowrap', color: colors.cardFgSubtle },
  // 명성, 점수 값(numeric.value 32 700).
  statValue: {
    ...numeric,
    minWidth: 0,
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    color: colors.cardFg
  },
  statMissing: { color: colors.cardBorderStrong },
  statDealer: { color: colors.scoreDealer },
  statBuffer: { color: colors.scoreBuffer },
  statTop: { color: colors.tierTop },
  statRanker: { color: colors.tierRanker },
  statVacant: { color: colors.cardBorder }
})
