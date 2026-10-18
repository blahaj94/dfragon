import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

// 공대 카드 값은 작업자가 정했다. 1280×800에서 296×200, 1024×640에서 약 232×147이고, 카드가 180보다
// 낮으면 직업 줄을 숨긴다. 머리 40, 소속과 이름, 명성 한 줄(값 Barlow 32)은 파티 카드의 같은 요소를
// 줄인 것이다.
const SHORT_CARD = '@container (max-height: 179px)'

// 숫자 단계(dfragon-design typography.md). 행간은 1이고 자릿수 폭을 고정한다.
const numeric = {
  fontFamily: font.num,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  letterSpacing: 0
} as const

const ellipsis = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

export const styles = stylex.create({
  // 펼친 동안은 행 높이를 채우고 그 높이로 직업 줄을 고른다.
  slot: { display: 'grid', gridTemplateRows: 'minmax(0, 1fr)', minWidth: 0, containerType: 'size' },
  slotCollapsed: { containerType: 'normal' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    height: 40,
    flexShrink: 0,
    minWidth: 0,
    paddingInline: space.s12
  },
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
    color: colors.cardFgMuted
  },
  numberVacant: { backgroundColor: colors.cardInset, color: colors.cardFgSubtle },
  numberTop: { backgroundColor: colors.tierTop, color: colors.cardOnSignal },
  numberRanker: { backgroundColor: colors.tierRanker, color: colors.cardOnSignal },
  // 공대 카드는 서버를 고치지 않으므로 칩 모양의 글자만 둔다.
  server: {
    ...ellipsis,
    display: 'inline-flex',
    alignItems: 'center',
    height: 24,
    paddingInline: space.s8,
    borderRadius: 2,
    backgroundColor: colors.cardControl,
    color: colors.cardFg,
    fontSize: 12,
    fontWeight: 600
  },
  spacer: { flex: 1, minWidth: 0 },
  rank: {
    ...numeric,
    flexShrink: 0,
    fontSize: 18,
    fontWeight: 600,
    color: colors.cardFgMuted,
    whiteSpace: 'nowrap'
  },
  rankTop: {
    display: 'inline-flex',
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
    display: 'inline-flex',
    alignItems: 'center',
    height: 24,
    paddingInlineStart: space.s8,
    paddingInlineEnd: space.s12,
    fontWeight: 700,
    backgroundColor: colors.tierRanker,
    color: colors.cardOnSignal
  },
  inlineName: { ...ellipsis, color: colors.cardFg },
  inlineFame: { ...numeric, flexShrink: 0, fontSize: 20, fontWeight: 700, color: colors.cardFg },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minWidth: 0,
    paddingInline: space.s16
  },
  affiliation: { display: 'flex', alignItems: 'center', gap: space.s8, minWidth: 0, height: 18 },
  adventure: { ...ellipsis, color: colors.cardFgAdventure },
  guild: { ...ellipsis, color: colors.rarityUnique },
  divider: { flexShrink: 0, width: 1, height: 10, backgroundColor: colors.cardBorderStrong },
  name: { ...ellipsis, color: colors.cardFg },
  job: {
    ...ellipsis,
    display: { default: 'block', [SHORT_CARD]: 'none' },
    paddingTop: space.s4,
    color: colors.cardFgMuted
  },
  vacant: { color: colors.cardBorderStrong },
  stats: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s8,
    flexShrink: 0,
    height: 48,
    margin: 0,
    marginTop: 'auto',
    paddingInline: space.s16,
    paddingBottom: space.s8,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardBorder
  },
  statsVacant: { borderTopStyle: 'dashed' },
  statsRanker: { borderTopColor: colors.tierRankerOutline },
  statLabel: { margin: 0, paddingBottom: 3, whiteSpace: 'nowrap', color: colors.cardFgSubtle },
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
  statVacant: { color: colors.cardBorder },
  // 상위, 랭커 카드의 숫자 값은 단계 색이다.
  top: { color: colors.tierTop },
  ranker: { color: colors.tierRanker }
})
