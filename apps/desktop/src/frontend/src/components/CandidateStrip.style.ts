import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, space } from '@dfragon/ui/tokens.stylex'

/** 타일 하나의 폭과 얼굴 칸 크기. 카드 기본 폭에서 네 장이 들어가고 다섯째 타일 끝이 보이는 크기다. */
const TILE_WIDTH = 54
export const FACE_SIZE = 40
/** 후보 줄 전체 높이. 카드 그림은 이만큼 위로 비켜선다. */
const STRIP_HEIGHT = 108

// 긴 모험단명은 일정한 속도로 3초 동안 끝까지 흐르고 1초 쉰 뒤 3초 동안 돌아와 1초 쉰다. 이동 거리는
// 글자 폭에서 칸 폭을 뺀 만큼이라 칸에 들어가는 이름은 움직이지 않는다.
const marquee = stylex.keyframes({
  '0%': { transform: 'translateX(0)' },
  '37.5%, 50%': { transform: `translateX(min(0px, calc(${TILE_WIDTH - 4}px - 100%)))` },
  '87.5%, 100%': { transform: 'translateX(0)' }
})

export const styles = stylex.create({
  // 후보 줄이 그림 칸 아래를 차지하면 카드의 캐릭터 그림은 그 위에서 그린다.
  aboveStrip: { bottom: STRIP_HEIGHT },
  strip: {
    position: 'absolute',
    insetInline: 0,
    bottom: 0,
    height: STRIP_HEIGHT,
    boxSizing: 'border-box',
    padding: space.s8,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.cardBg
  },
  tiles: {
    display: 'flex',
    gap: 6,
    height: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'thin',
    scrollbarColor: `${colors.cardFgMuted} ${colors.cardBorder}`
  },
  tile: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
    width: TILE_WIDTH,
    height: 84,
    boxSizing: 'border-box',
    paddingTop: 6,
    paddingInline: 2,
    paddingBottom: 4,
    borderWidth: 0,
    borderRadius: radius.control,
    backgroundColor: {
      default: colors.cardInset,
      ':hover': colors.cardControlHover
    },
    color: colors.cardFgMuted,
    cursor: 'pointer',
    transitionProperty: 'background-color, color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    outline: { default: null, ':focus-visible': `2px solid ${colors.cardSignal}` },
    outlineOffset: { default: null, ':focus-visible': 2 }
  },
  shown: { boxShadow: `inset 0 0 0 2px ${colors.cardSignal}`, color: colors.cardSignal },
  preview: {
    backgroundColor: `color-mix(in srgb, ${colors.cardSignal} 12%, transparent)`,
    boxShadow: `inset 0 0 0 2px ${colors.cardSignal}`,
    color: colors.cardFg
  },
  // 미리보기 중인 타일의 오른쪽 위 확정 표시. 한 번 더 누르면 확정이라는 뜻이다.
  check: {
    position: 'absolute',
    top: 0,
    right: 0,
    display: 'grid',
    placeItems: 'center',
    width: 18,
    height: 18,
    backgroundColor: colors.cardSignal,
    color: colors.cardOnSignal,
    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
  },
  face: {
    position: 'relative',
    flexShrink: 0,
    width: FACE_SIZE,
    height: FACE_SIZE,
    overflow: 'hidden',
    backgroundColor: colors.cardBg
  },
  faceMissing: {
    display: 'grid',
    placeItems: 'center',
    boxShadow: `inset 0 0 0 1px ${colors.cardBorder}`,
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
  }),
  adventure: {
    alignSelf: 'stretch',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 600,
    color: colors.cardFgAdventure
  },
  adventureMissing: { color: colors.cardBorderStrong },
  marquee: {
    display: { default: 'inline-block', '@media (prefers-reduced-motion: reduce)': 'inline' },
    animationName: { default: marquee, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: '8s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite'
  },
  server: {
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    whiteSpace: 'nowrap'
  }
})
