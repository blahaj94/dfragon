import * as stylex from '@stylexjs/stylex'
import { colors, motion, size, space } from '@dfragon/ui/tokens.stylex'

const pulseTopLeft = stylex.keyframes({
  '0%': { transform: 'translate(-4px, -4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseTopRight = stylex.keyframes({
  '0%': { transform: 'translate(4px, -4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseBottomLeft = stylex.keyframes({
  '0%': { transform: 'translate(-4px, 4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseBottomRight = stylex.keyframes({
  '0%': { transform: 'translate(4px, 4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})

export const styles = stylex.create({
  // 칩의 모양을 그대로 보이고, 칩이 오른쪽 위를 잘라 바깥 outline이 가려지지 않도록 포커스 링은 버튼 바깥에 둔다.
  trigger: {
    display: 'inline-flex',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  },
  backdrop: {
    position: 'fixed',
    top: `env(titlebar-area-height, ${size.topbar})`,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    backgroundColor: colors.bgOverlay,
    opacity: { default: 1, ':is([data-starting-style], [data-ending-style])': 0 },
    transitionProperty: 'opacity',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  dialog: {
    position: 'fixed',
    top: `calc(env(titlebar-area-height, ${size.topbar}) + 4px)`,
    right:
      'max(24px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 16px))',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    width: 760,
    maxWidth: 'calc(100vw - 32px)',
    height: 104,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
    opacity: { default: 1, ':is([data-starting-style], [data-ending-style])': 0 },
    transitionProperty: 'opacity',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease,
    outlineStyle: 'none'
  },
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderStyle: 'solid',
    borderWidth: 0,
    pointerEvents: 'none',
    transitionProperty: 'border-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  topLeft: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  bottomLeft: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  bottomRight: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  neutral: { borderColor: colors.borderStrong },
  success: { borderColor: colors.fgSuccess },
  danger: { borderColor: colors.fgDanger },
  warning: { borderColor: colors.fgWarning },
  signal: { borderColor: colors.signal },
  pulse: {
    animationDuration: `calc(${motion.beat} * 2)`,
    animationIterationCount: 'infinite',
    animationTimingFunction: motion.ease
  },
  pulseTopLeft: {
    animationName: { default: pulseTopLeft, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseTopRight: {
    animationName: { default: pulseTopRight, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseBottomLeft: {
    animationName: { default: pulseBottomLeft, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseBottomRight: {
    animationName: {
      default: pulseBottomRight,
      '@media (prefers-reduced-motion: reduce)': 'none'
    }
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    height: 44,
    flexShrink: 0,
    paddingInlineStart: space.s16,
    paddingInlineEnd: space.s12
  },
  title: { flexShrink: 0, margin: 0 },
  // 닫기 아이콘은 18px이다. IconButton sm의 16px 아이콘 칸 가운데에 두려고 바깥으로 1px씩 넘긴다.
  closeIcon: { width: 18, height: 18, margin: -1 },
  body: { paddingInline: space.s16, paddingBottom: space.s16 },
  secondaryAction: {
    paddingLeft: 18,
    paddingRight: 18,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    // 공용 보조 버튼의 투명 면과 같은 속성을 피해 배경 이미지로 채운다.
    backgroundImage: {
      default: `linear-gradient(${colors.bgControl}, ${colors.bgControl})`,
      ':hover:not(:disabled)': `linear-gradient(${colors.bgControlHover}, ${colors.bgControlHover})`
    }
  },
  primaryAction: { paddingLeft: 18, paddingRight: 20 }
})
