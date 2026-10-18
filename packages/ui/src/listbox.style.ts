import * as stylex from '@stylexjs/stylex'
import { colors, motion, shape, space } from './tokens.stylex'

const cut = shape.cut
// 오른쪽 아래를 자른 모양과, 같은 꼭짓점 수로 위쪽 한 줄에 접힌 모양. 둘 사이를 전환해 위에서 아래로 펼친다.
const openShape = `polygon(0 0, 100% 0, 100% calc(100% - ${cut}), calc(100% - ${cut}) 100%, 0 100%)`
const foldedShape = 'polygon(0 0, 100% 0, 100% 0, 100% 0, 0 0)'

// Select와 Menu가 함께 쓰는 아래로 펼치는 목록 모양.
export const listboxStyles = stylex.create({
  positioner: { zIndex: 110, outlineStyle: 'none' },
  popup: {
    boxSizing: 'border-box',
    minWidth: 'max(112px, var(--anchor-width))',
    maxHeight: 'var(--available-height)',
    paddingBlock: space.s4,
    overflowY: 'auto',
    borderTopWidth: 2,
    borderTopStyle: 'solid',
    borderTopColor: colors.signal,
    backgroundColor: colors.bgInset,
    boxShadow: `inset 0 0 0 1px ${colors.borderStrong}`,
    color: colors.fgMuted,
    outlineStyle: 'none',
    clipPath: {
      default: openShape,
      ':is([data-starting-style], [data-ending-style])': foldedShape
    },
    transitionProperty: 'clip-path',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  item: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    paddingInline: space.s12,
    outlineStyle: 'none',
    cursor: { default: 'pointer', ':is([data-disabled])': 'not-allowed' },
    userSelect: 'none',
    // 현재 항목(Select의 data-selected, Menu radio의 data-checked)은 신호색 굵은 글자다.
    color: {
      default: 'inherit',
      ':is([data-highlighted])': colors.fgDefault,
      ':is([data-selected], [data-checked])': colors.signal,
      ':is([data-disabled])': colors.fgDisabled
    },
    fontWeight: { default: 'inherit', ':is([data-selected], [data-checked])': 700 },
    backgroundColor: { default: 'transparent', ':is([data-highlighted])': colors.bgControlHover },
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  // 현재 항목 왼쪽의 2px 막대. 선택된 항목에만 렌더링되는 Base UI indicator에 둔다.
  marker: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    width: 2,
    backgroundColor: colors.signal
  },
  groupLabel: {
    paddingInline: space.s12,
    paddingBlock: space.s4,
    fontSize: 12,
    lineHeight: '18px',
    fontWeight: 600,
    color: colors.fgSubtle
  },
  separator: {
    height: 1,
    marginBlock: space.s4,
    backgroundColor: colors.borderDefault
  }
})
