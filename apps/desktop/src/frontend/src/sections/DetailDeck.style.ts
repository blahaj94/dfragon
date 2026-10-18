import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, radius, space } from '@dfragon/ui/tokens.stylex'

// dfragon-design layout.md의 보조 창 카드 더미: 선택한 카드 816 × 576(8열)을 앞에 두고 나머지 네 장을
// 오른쪽으로 104, 아래로 8씩 밀어 겹친다. 다섯 장의 폭은 콘텐츠 안쪽 폭 1232와 같다. 최소 창에서는
// 콘텐츠 영역이 가로로 스크롤한다.
const CARD_WIDTH = 816
const CARD_HEIGHT = 576
const OFFSET_X = 104
const OFFSET_Y = 8
const BACK_CARDS = 4

// 숫자 단계(dfragon-design typography.md). 행간은 1이고 자릿수 폭을 고정한다.
const numeric = {
  fontFamily: font.num,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  letterSpacing: 0
} as const

export const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s24,
    minWidth: CARD_WIDTH + OFFSET_X * BACK_CARDS,
    paddingBottom: space.s16,
    color: colors.fgDefault
  },
  identity: { display: 'flex', flexDirection: 'column', gap: space.s4, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: space.s12, minWidth: 0 },
  name: { minWidth: 0, overflowWrap: 'anywhere' },
  // 서버는 고를 수 없는 표시라 칩 모양의 글자만 둔다.
  server: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 24,
    paddingInline: space.s8,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    color: colors.fgDefault
  },
  subtitle: { display: 'flex', alignItems: 'center', gap: space.s8, color: colors.fgMuted },
  adventure: { color: colors.fgAdventure },
  divider: { flexShrink: 0, width: 1, height: 10, backgroundColor: colors.borderStrong },
  scores: { display: 'flex', gap: space.s24, margin: 0 },
  scoreItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: space.s8,
    minWidth: 120
  },
  label: { color: colors.fgSubtle },
  // 숫자 값(numeric.value 32 700).
  score: { ...numeric, margin: 0, fontSize: 32, fontWeight: 700, color: colors.fgDefault },
  scoreMissing: { color: colors.fgDisabled },
  deck: {
    position: 'relative',
    minWidth: CARD_WIDTH + OFFSET_X * BACK_CARDS,
    height: CARD_HEIGHT + OFFSET_Y * BACK_CARDS
  },
  // 카드 자리. 카드를 고르면 자리가 180ms에 옮겨 가고, 동작 줄이기 설정에서는 바로 옮긴다.
  card: (rank: number) => ({
    position: 'absolute',
    display: 'grid',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    left: rank * OFFSET_X,
    top: rank * OFFSET_Y,
    zIndex: BACK_CARDS + 1 - rank,
    transitionProperty: 'left, top',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  }),
  // 카드 전체가 고르는 버튼이고, 뒤 카드에서는 보이는 104 띠에 이름과 번호를 둔다.
  selector: {
    position: 'absolute',
    inset: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: { default: colors.cardFgMuted, ':hover': colors.cardFg },
    cursor: 'pointer',
    textAlign: 'right',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.cardSignal,
    outlineOffset: -4,
    transitionProperty: 'color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  selectorActive: { cursor: 'default' },
  tabLabel: {
    position: 'absolute',
    top: space.s24,
    right: 0,
    width: OFFSET_X,
    textAlign: 'center'
  },
  number: {
    ...numeric,
    position: 'absolute',
    bottom: space.s24,
    right: 0,
    width: OFFSET_X,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: colors.cardFgSubtle
  },
  edge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.cardBorder,
    pointerEvents: 'none'
  },
  title: { margin: 0, position: 'absolute', top: space.s24, left: space.s24, color: colors.cardFg },
  content: { position: 'absolute', inset: '72px 24px 24px', pointerEvents: 'none' },
  cardIdentity: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12 },
  cardAdventure: { color: colors.cardFgAdventure },
  characterName: { paddingBlock: space.s8, color: colors.cardFg },
  job: { color: colors.cardFgMuted },
  pending: {
    display: 'grid',
    placeContent: 'center',
    height: '100%',
    textAlign: 'center',
    gap: space.s12,
    color: colors.cardFgMuted
  },
  note: { paddingTop: space.s12, color: colors.cardFgMuted, textAlign: 'center' }
})
