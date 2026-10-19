import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from '@dfragon/ui/tokens.stylex'

// 줄 화살표 색. 줄에 마우스를 올리면 화살표만 신호색이 된다.
const CHEVRON = '--notice-row-chevron'

// 값은 DFragon 디자인 캔버스의 라이선스 사용고지, 고지 상세 보드를 따른다.
export const styles = stylex.create({
  list: { listStyle: 'none', padding: 0, margin: 0 },
  item: {
    backgroundColor: { default: null, ':nth-child(odd)': colors.bgStripe }
  },
  // 줄은 48 높이에 이름, 버전 두 줄과 폭 120의 라이선스, 오른쪽 화살표다. 긴 이름과 라이선스는 줄을 늘린다.
  row: {
    [CHEVRON]: { default: colors.fgSubtle, ':hover': colors.signal },
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    minHeight: 48,
    boxSizing: 'border-box',
    margin: 0,
    paddingBlock: 4,
    paddingLeft: 12,
    paddingRight: 8,
    borderWidth: 0,
    borderRadius: radius.panel,
    backgroundColor: { default: 'transparent', ':hover': colors.bgControl },
    color: colors.fgDefault,
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: -2
  },
  name: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  nameText: { fontSize: 15, lineHeight: '20px', fontWeight: 600, overflowWrap: 'anywhere' },
  nameDetail: { fontSize: 12, lineHeight: '16px', color: colors.fgSubtle },
  license: {
    flexShrink: 0,
    width: 120,
    fontSize: 13,
    lineHeight: '18px',
    color: colors.fgMuted,
    overflowWrap: 'anywhere'
  },
  rowChevron: { flexShrink: 0, width: 16, height: 16, color: `var(${CHEVRON})` },
  // 상세를 열 때 본문을 뒤로 가기까지 올리되 본문 위 여백(24에서 위로 당긴 4를 뺀 20)은 남긴다.
  back: {
    alignSelf: 'flex-start',
    scrollMarginTop: 20,
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: 4,
    height: 28,
    marginTop: -4,
    marginLeft: -4,
    paddingLeft: 2,
    paddingRight: 6,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: { default: colors.fgMuted, ':hover': colors.fgDefault },
    font: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  },
  backIcon: { width: 16, height: 16, flexShrink: 0 },
  heading: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 24,
    lineHeight: '32px',
    fontWeight: 700,
    overflowWrap: 'anywhere',
    outlineStyle: 'none'
  },
  tags: { display: 'flex', alignItems: 'center', gap: 8 },
  tag: {
    display: 'flex',
    alignItems: 'center',
    minHeight: 24,
    paddingLeft: 8,
    paddingRight: 12,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted,
    fontSize: 12,
    lineHeight: '18px',
    fontWeight: 700,
    overflowWrap: 'anywhere'
  },
  version: { fontSize: 12, lineHeight: '18px', color: colors.fgSubtle },
  notice: {
    marginTop: 20,
    paddingBlock: 16,
    paddingInline: 20,
    backgroundColor: colors.bgBar,
    color: colors.fgMuted,
    fontSize: 13,
    lineHeight: '22px'
  },
  documentTitle: {
    margin: 0,
    marginBottom: 8,
    fontSize: 15,
    lineHeight: '22px',
    fontWeight: 700,
    color: colors.fgDefault,
    overflowWrap: 'anywhere'
  },
  original: {
    margin: 0,
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere'
  }
})
