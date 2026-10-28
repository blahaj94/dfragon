import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

const PORTRAIT_SIZE = 64
const PORTRAIT_BORDER = 2
export const FACE_SIZE = PORTRAIT_SIZE - PORTRAIT_BORDER * 2
const CLOSE_SIZE = 24
const CLOSE_CLEARANCE = 34

export const styles = stylex.create({
  window: {
    position: 'absolute',
    zIndex: 1,
    top: -6,
    left: 8,
    right: -8,
    boxSizing: 'border-box',
    paddingBlock: space.s8,
    paddingInlineStart: space.s8,
    borderTopWidth: 2,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardSignal,
    backgroundColor: colors.cardBg,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)'
  },
  close: {
    position: 'absolute',
    top: space.s4,
    right: space.s4,
    display: 'grid',
    placeItems: 'center',
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    padding: 0,
    borderWidth: 0,
    backgroundColor: { default: colors.cardControl, ':hover': colors.cardControlHover },
    color: colors.cardSignal,
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    outline: { default: null, ':focus-visible': `2px solid ${colors.cardSignal}` },
    outlineOffset: { default: null, ':focus-visible': 2 }
  },
  closeIcon: { width: 14, height: 14 },
  portraits: {
    display: 'flex',
    gap: space.s8,
    paddingInlineEnd: CLOSE_CLEARANCE,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'thin',
    scrollbarColor: `${colors.cardFgMuted} ${colors.cardBorder}`
  },
  portrait: {
    position: 'relative',
    flexShrink: 0,
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    boxSizing: 'border-box',
    padding: 0,
    overflow: 'hidden',
    borderWidth: PORTRAIT_BORDER,
    borderStyle: 'solid',
    borderColor: { default: 'transparent', ':hover': colors.cardBorder },
    backgroundColor: colors.cardInset,
    cursor: 'pointer',
    transitionProperty: 'border-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    outline: { default: null, ':focus-visible': `2px solid ${colors.cardSignal}` },
    outlineOffset: { default: null, ':focus-visible': -2 }
  },
  shown: { borderColor: colors.cardBorderStrong },
  preview: { borderColor: colors.cardSignal },
  check: {
    position: 'absolute',
    top: 0,
    right: 0,
    display: 'grid',
    placeItems: 'center',
    width: 16,
    height: 16,
    backgroundColor: colors.cardSignal,
    color: colors.cardOnSignal,
    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 6px))'
  },
  faceMissing: {
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    height: '100%',
    color: colors.cardBorderStrong
  },
  faceImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    maxWidth: 'none',
    transformOrigin: '0 0',
    imageRendering: 'pixelated'
  },
  faceWindow: (x: number, y: number, scale: number) => ({
    transform: `scale(${scale}) translate(${-x}px, ${-y}px)`
  })
})
