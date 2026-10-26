import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

/** 후보 초상화 한 칸의 크기 */
const PORTRAIT_SIZE = 64
/** 초상화 칸의 테두리 두께. 얼굴은 테두리 안쪽을 채운다. */
const PORTRAIT_BORDER = 2
/** 테두리 안쪽에 그리는 얼굴 창의 크기 */
export const FACE_SIZE = PORTRAIT_SIZE - PORTRAIT_BORDER * 2
/** 오른쪽 위 닫기 버튼의 크기 */
const CLOSE_SIZE = 24
/** 초상화 줄 오른쪽 끝을 비우는 폭. 닫기 버튼(24)과 여백(10)이 가리지 않게 한다. */
const CLOSE_CLEARANCE = 34

// 카드 위에 한 겹 더 뜨는 후보 창. 카드보다 위로 6, 오른쪽으로 8 비켜 카드를 덮는다.
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
  // 카드 폭에 다 들어가지 않는 후보는 가로로 넘긴다.
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
  // 지금 카드가 보이는 후보는 회색, 미리보기 중인 후보는 크림 테두리다.
  shown: { borderColor: colors.cardBorderStrong },
  preview: { borderColor: colors.cardSignal },
  // 미리보기 중인 초상화의 오른쪽 위 체크. 한 번 더 누르면 확정이라는 뜻이다.
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
  // 얼굴 창의 왼쪽 위를 칸 원점으로 옮긴 뒤 창 폭을 칸 폭에 맞춘다.
  faceWindow: (x: number, y: number, scale: number) => ({
    transform: `scale(${scale}) translate(${-x}px, ${-y}px)`
  })
})
