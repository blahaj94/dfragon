import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, radius, space } from '@dfragon/ui/tokens.stylex'

// 이름 수정 중의 네모 점 3개. 파티 카드와 같은 박자다(motion.md).
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

// 값은 DFragon 디자인 캔버스 공대 보드의 축약 카드다. 파티 카드보다 작은 머리 36, 그림 칸 72, 스탯 한 줄과
// 명성, 장비 점수 바닥으로 1280×800에 12장이 스크롤 없이 들어간다.
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
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    flexShrink: 0,
    minWidth: 0,
    paddingInline: 10
  },
  // 카드 번호 칩(14 700). 오른쪽 위를 자른다.
  number: {
    ...numeric,
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 20,
    paddingInlineStart: 6,
    paddingInlineEnd: space.s8,
    fontSize: 14,
    fontWeight: 700,
    backgroundColor: colors.cardControl,
    color: colors.cardFgMuted,
    transitionProperty: 'background-color, color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  numberSelected: { backgroundColor: colors.cardSignal, color: colors.cardOnSignal },
  numberTop: { backgroundColor: colors.tierTop, color: colors.cardOnSignal },
  numberRanker: { backgroundColor: colors.tierRanker, color: colors.cardOnSignal },
  server: { display: 'flex', flexShrink: 1, minWidth: 0, maxWidth: '50%' },
  spacer: { flex: 1, minWidth: 0 },
  // 서버 순위(16 600). 상위는 단계 색 테두리, 랭커는 오른쪽 위를 자른 단계 색 면이다.
  rank: {
    ...numeric,
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    fontSize: 16,
    fontWeight: 600,
    color: colors.cardFgMuted,
    whiteSpace: 'nowrap'
  },
  rankTop: {
    boxSizing: 'border-box',
    height: 20,
    paddingInline: 6,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: colors.tierTop,
    fontWeight: 700,
    color: colors.tierTop
  },
  rankRanker: {
    height: 20,
    paddingInlineStart: 6,
    paddingInlineEnd: 10,
    fontWeight: 700,
    backgroundColor: colors.tierRanker,
    color: colors.cardOnSignal
  },
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
  // 검색 실패 `!` 칸(15 700).
  alert: {
    ...numeric,
    fontSize: 15,
    fontWeight: 700,
    backgroundColor: colors.bgDangerWeak,
    color: colors.fgDanger
  },
  waitingMark: { backgroundColor: colors.cardInset, color: colors.cardFgSubtle },
  detail: {
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    width: 24,
    height: 24,
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
  // 그림 칸 72와 소속, 이름, 직업. 접으면 그림 칸이 빠지고 한 칸이 된다.
  body: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr)',
    gap: space.s12,
    flexShrink: 0,
    minHeight: 0,
    paddingInline: space.s12
  },
  bodyCollapsed: { gridTemplateColumns: 'minmax(0, 1fr)' },
  well: { position: 'relative', height: 72, overflow: 'hidden' },
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
  identity: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
    paddingTop: 6
  },
  affiliation: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: '13px',
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
    height: 9,
    backgroundColor: colors.cardBorderStrong
  },
  affiliationPlaceholder: { color: colors.cardBorderStrong },
  // 이름은 평소 테두리 없는 18 700 글자이고, 고치는 동안 신호색 상자가 된다. 글자가 모험단과 같은 세로줄에
  // 오도록 상자 안쪽 여백과 테두리만큼 왼쪽으로 내민다.
  name: {
    boxSizing: 'border-box',
    width: 'calc(100% + 8px)',
    minWidth: 0,
    height: 26,
    marginBlock: -1,
    marginInlineStart: -8,
    paddingBlock: 0,
    paddingInline: 6,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: { default: 'transparent', ':hover:not(:disabled)': colors.cardBorder },
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    color: colors.cardFg,
    fontFamily: 'inherit',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: '22px',
    textOverflow: 'ellipsis',
    outlineStyle: 'none',
    transitionProperty: 'border-color, background-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease,
    '::placeholder': { color: colors.cardFgSubtle }
  },
  // 빈 이름 칸은 14 600 자리 표시 글자다.
  nameEmpty: { fontSize: 14, fontWeight: 600 },
  nameWaiting: { borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.bgWell },
  nameFailure: { fontSize: 17, borderColor: colors.fgDanger, backgroundColor: colors.bgWell },
  nameSelected: { fontSize: 17, borderColor: colors.cardSignal, backgroundColor: colors.bgWell },
  job: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.cardFgMuted
  },
  // 스탯 한 줄. 세 칸과 좁은 스위칭 칸이다.
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) 34px',
    gap: 6,
    margin: 0,
    marginTop: 'auto',
    paddingTop: space.s4,
    paddingInline: space.s12,
    paddingBottom: space.s8
  },
  stat: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  statLabel: {
    margin: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: 10,
    lineHeight: '12px',
    color: colors.cardFgSubtle
  },
  statValue: { margin: 0, whiteSpace: 'nowrap', lineHeight: '18px' },
  statNumber: { ...numeric, fontSize: 16, fontWeight: 700, color: colors.cardFg },
  statMissing: { color: colors.cardBorderStrong },
  statUnit: { marginInlineStart: 1, fontSize: 10, fontWeight: 500, color: colors.cardFgSubtle },
  // 실패, 결과 0건, 입력 안내. 스탯 한 줄 자리에 세 줄까지 두고 넘치면 줄임표로 끝낸다.
  notice: {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    overflow: 'hidden',
    margin: 0,
    marginTop: 'auto',
    paddingTop: space.s4,
    paddingInline: space.s12,
    paddingBottom: space.s4,
    fontSize: 12,
    lineHeight: '16px',
    color: colors.cardFgMuted
  },
  hidden: { display: 'none' },
  // 명성과 장비 점수. 라벨은 왼쪽 11, 값은 오른쪽 22 700이다.
  footer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
    flexShrink: 0,
    margin: 0,
    marginTop: 'auto',
    paddingTop: space.s8,
    paddingInline: space.s12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardBorder
  },
  // 스탯 한 줄이나 안내가 바닥 바로 위에 붙도록, 그 위의 남는 높이는 그쪽이 차지한다.
  footerAfterRow: { marginTop: 0 },
  footerVacant: { borderTopStyle: 'dashed' },
  footerRanker: { borderTopColor: colors.tierRankerOutline },
  footerItem: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    minWidth: 0
  },
  footerLabel: {
    margin: 0,
    whiteSpace: 'nowrap',
    fontSize: 11,
    lineHeight: '14px',
    color: colors.cardFgSubtle
  },
  footerValue: {
    ...numeric,
    minWidth: 0,
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    lineHeight: '22px',
    whiteSpace: 'nowrap',
    color: colors.cardFg
  },
  footerMissing: { color: colors.cardBorderStrong },
  footerVacantValue: { color: colors.cardBorder },
  fameTop: { color: colors.tierTop },
  fameRanker: { color: colors.tierRanker }
})
