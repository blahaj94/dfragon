import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, radius, size, space } from '@dfragon/ui/tokens.stylex'

// 이름 수정 중의 네모 점 3개. 한 박자를 셋으로 나눠 차례로 켜고 끊어서 바꾼다(motion.md).
const dotBlink = stylex.keyframes({
  '0%': { opacity: 1 },
  '33.333%, 100%': { opacity: 0.25 }
})

// 접을 때 사라지는 부분은 높이를 상태 전환 시간에 줄이고, 불투명도는 motion.md의 예외대로 120ms
// 직선으로 줄인다. visibility도 같은 시간 뒤 숨겨 접힌 동안 포커스와 보조 기술에서 빠진다.
const collapseTransition = {
  transitionProperty: 'max-height, opacity, visibility',
  transitionDuration: `${motion.durState}, ${motion.durHover}, ${motion.durHover}`,
  transitionTimingFunction: `${motion.ease}, linear, linear`
} as const

// 최소 창의 232 카드에서는 서버 칩 글자를 지키려고 서버 순위를 숨긴다.
const NARROW_HEADER = '@container (max-width: 240px)'

// 숫자 단계(dfragon-design typography.md). 행간은 1이고 자릿수 폭을 고정한다.
const numeric = {
  fontFamily: font.num,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  letterSpacing: 0
} as const

export const styles = stylex.create({
  // 그리드 칸을 채우는 자리. 카드는 펼친 동안 파티 영역 높이를 채운다.
  slot: { display: 'grid', gridTemplateRows: 'minmax(0, 1fr)', minWidth: 0 },
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
  // 서버 순위(numeric.rank 18 600).
  rank: {
    ...numeric,
    display: { default: 'inline', [NARROW_HEADER]: 'none' },
    flexShrink: 0,
    fontSize: 18,
    fontWeight: 600,
    color: colors.cardFgMuted,
    whiteSpace: 'nowrap'
  },
  // 상위 순위는 단계 색 테두리, 랭커 순위는 오른쪽 위를 자른 단계 색 면이다.
  rankTop: {
    display: { default: 'inline-flex', [NARROW_HEADER]: 'none' },
    alignItems: 'center',
    boxSizing: 'border-box',
    height: 24,
    paddingInline: space.s8,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: colors.tierTop,
    fontWeight: 700,
    color: colors.tierTop
  },
  rankRanker: {
    display: { default: 'inline-flex', [NARROW_HEADER]: 'none' },
    alignItems: 'center',
    height: 24,
    paddingInlineStart: space.s8,
    paddingInlineEnd: space.s12,
    fontWeight: 700,
    backgroundColor: colors.tierRanker,
    color: colors.cardOnSignal
  },
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
  detail: {
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    width: 32,
    height: 32,
    marginInlineEnd: -4,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: {
      default: colors.cardFgSubtle,
      ':hover:not(:disabled)': colors.cardFg,
      ':disabled': colors.cardBorderStrong
    },
    cursor: { default: 'pointer', ':disabled': 'default' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.cardSignal,
    outlineOffset: -2,
    transitionProperty: 'color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  body: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 },
  characterFace: { display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0 },
  // 장비와 기타 면은 캐릭터 면의 그림 칸과 소속 자리를 채우고, 창이 낮아 넘치면 면 안에서 스크롤한다.
  face: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto'
  },
  // 면 맨 위의 이름(18 700)과 직업(12) 한 줄. 높이 44다.
  faceTitle: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    height: 44,
    minWidth: 0,
    paddingInline: space.s16
  },
  faceName: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: '26px',
    color: colors.cardFg
  },
  faceJob: { flexShrink: 0, whiteSpace: 'nowrap', color: colors.cardFgSubtle },
  equipment: { display: 'flex', flexDirection: 'column', paddingInline: space.s12 },
  equipmentDivider: {
    flexShrink: 0,
    height: 1,
    marginInline: space.s4,
    backgroundColor: colors.cardDivider
  },
  investment: { paddingInline: space.s16 },
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
  // 이름은 평소 테두리 없는 글자로 보이고, 고치는 동안 카드 신호색 상자가 된다. 글자가 모험단과 같은
  // 세로줄에 오도록 상자 안쪽 여백과 테두리만큼 왼쪽으로 내민다.
  // Typo가 요소 margin을 0으로 두므로 내미는 여백은 감싼 상자에 준다.
  nameBox: { minWidth: 0, marginTop: 3, marginBottom: -1, marginInlineStart: -10 },
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
  // 캐릭터 면의 스탯 한 줄(캔버스 카드 면 보드). 같은 폭 세 칸과 40 폭 스위칭 칸이고, 라벨은 최소 글자
  // 크기 12, 값은 Barlow 18 700이다.
  statLine: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) 40px',
    gap: 6,
    margin: 0,
    marginTop: 2,
    paddingTop: space.s8,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardDivider
  },
  // 최소 창의 좁은 카드에서는 라벨을 줄이지 않고 어절 단위로 감싸며, 값은 칸 아래에 맞춘다.
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: 2,
    minWidth: 0
  },
  statItemLabel: { margin: 0, color: colors.cardFgSubtle },
  statItemValue: { margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: '22px' },
  statItemNumber: { ...numeric, fontSize: 18, fontWeight: 700, color: colors.cardFg },
  statItemMissing: { color: colors.cardBorderStrong },
  statItemUnit: { marginInlineStart: 1, fontWeight: 500, color: colors.cardFgSubtle },
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
  statVacant: { color: colors.cardBorder },
  faces: { ...collapseTransition, flexShrink: 0, maxHeight: 41, overflow: 'hidden' },
  facesVacant: {
    boxSizing: 'border-box',
    height: 41,
    borderTopWidth: 1,
    borderTopStyle: 'dashed',
    borderTopColor: colors.cardBorder
  }
})
