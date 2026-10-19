import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, space } from '@dfragon/ui/tokens.stylex'

// 줄의 희귀도 색. 왼쪽 2px 선, 왼쪽에서 옅어지는 면, 포커스 테두리와 설명 상자 위 선이 같은 색을 쓴다.
const RARITY = '--detail-row-rarity'
const rarity = `var(${RARITY})`

// DFragon 디자인 캔버스 상세 창 보드의 장비 목록. 줄은 최소 높이 40, 칸 28 뒤에 이름과 옵션 두 줄, 오른쪽에
// 강화나 증폭이다. 보드의 옵션 줄 11px은 카드 면 최소 글자 크기 12px로 올렸다.
export const styles = stylex.create({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    margin: 0,
    padding: 0,
    listStyle: 'none'
  },
  row: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '28px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: space.s8,
    minHeight: 40,
    boxSizing: 'border-box',
    paddingBlock: space.s4,
    paddingLeft: 6,
    paddingRight: space.s8,
    backgroundColor: colors.cardInset,
    backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${rarity} 18%, transparent), transparent 75%)`,
    boxShadow: `inset 2px 0 0 ${rarity}`,
    outline: 'none'
  },
  lead: {
    paddingBlock: 6,
    backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${rarity} 28%, transparent), transparent 85%)`
  },
  spaced: { marginTop: space.s8 },
  rowMissing: { [RARITY]: colors.cardBorder, backgroundImage: 'none' },
  // 마우스, 키보드 포커스, 열린 설명 상자에서 줄을 희귀도 색 테두리로 감싼다.
  interactive: {
    cursor: 'default',
    boxShadow: {
      default: `inset 2px 0 0 ${rarity}`,
      ':is(:hover, :focus-visible, [data-popup-open])': `inset 2px 0 0 ${rarity}, inset 0 0 0 1px color-mix(in srgb, ${rarity} 60%, transparent)`
    },
    transitionProperty: 'box-shadow',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  text: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  name: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
    fontWeight: 500,
    lineHeight: '17px'
  },
  nameMissing: { color: colors.cardBorderStrong },
  enchant: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '16px',
    color: colors.cardFgSubtle
  },
  reinforce: {
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: '22px',
    textAlign: 'right'
  },
  // 캔버스 보드의 설명 상자. 폭 280, 위 2px 희귀도 선, 카드 테두리 색 1px 둘레와 그림자다.
  tip: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s8,
    width: 280,
    boxSizing: 'border-box',
    padding: space.s12,
    backgroundColor: colors.cardInset,
    borderTopWidth: 2,
    borderTopStyle: 'solid',
    borderTopColor: rarity,
    boxShadow: `0 0 0 1px ${colors.cardBorderStrong}, 0 12px 32px rgb(0 0 0 / 60%)`,
    color: colors.cardFg,
    fontSize: 12,
    lineHeight: '18px'
  },
  tipHead: { display: 'flex', alignItems: 'center', gap: space.s8 },
  tipName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: '20px' },
  tipReinforce: {
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 24,
    fontWeight: 700,
    lineHeight: '24px'
  },
  tipKind: { color: colors.cardFgSubtle },
  tipField: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: space.s8,
    color: colors.cardFgMuted
  },
  tipFieldLabel: { flexShrink: 0 },
  tipFieldValue: { color: colors.cardFg, textAlign: 'right' }
})

export const reinforceStyles = stylex.create({
  enhance: { color: colors.gameEnhance },
  amplify: { color: colors.gameAmplify },
  missing: { color: colors.cardBorderStrong }
})

// 희귀도 색 토큰 키별 줄 색. 모르는 희귀도는 카드 글자색이다.
export const rowTones = stylex.create({
  common: { [RARITY]: colors.rarityCommon },
  uncommon: { [RARITY]: colors.rarityUncommon },
  rare: { [RARITY]: colors.rarityRare },
  unique: { [RARITY]: colors.rarityUnique },
  epic: { [RARITY]: colors.rarityEpic },
  legendary: { [RARITY]: colors.rarityLegendary },
  chronicle: { [RARITY]: colors.rarityChronicle },
  primordial: { [RARITY]: colors.rarityPrimordial },
  unknown: { [RARITY]: colors.cardFg }
})
