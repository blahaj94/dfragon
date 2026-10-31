import * as stylex from '@stylexjs/stylex'
import { siteColors } from '../theme.stylex'

const pulse = stylex.keyframes({
  '0%': { boxShadow: `0 0 0 0 color-mix(in srgb, ${siteColors.highlight} 70%, transparent)` },
  '100%': { boxShadow: `0 0 0 14px color-mix(in srgb, ${siteColors.highlight} 0%, transparent)` }
})

const ripple = stylex.keyframes({
  '0%': { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 1 },
  '100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }
})

const reducedMotion = '@media (prefers-reduced-motion: reduce)'

export const styles = stylex.create({
  wrapper: { width: 'max-content' },
  layer: {
    position: 'fixed',
    inset: 0,
    zIndex: 20,
    overflow: 'hidden',
    pointerEvents: 'none'
  },
  box: (top: number, left: number, width: number, height: number) => ({
    top,
    left,
    width,
    height
  }),
  ring: {
    position: 'absolute',
    boxSizing: 'border-box',
    borderWidth: 3,
    borderStyle: 'solid',
    borderColor: siteColors.highlight,
    animationName: { default: pulse, [reducedMotion]: 'none' },
    animationDuration: '1.4s',
    animationTimingFunction: 'ease-out',
    animationIterationCount: 'infinite',
    transitionProperty: 'top, left, width, height',
    transitionDuration: { default: '180ms', [reducedMotion]: '0s' }
  },
  cursor: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    transitionProperty: 'transform, opacity',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  cursorAt: (x: number, y: number, moveMs: number, shown: boolean) => ({
    transform: `translate(${x}px, ${y}px)`,
    transitionDuration: `${moveMs}ms, 200ms`,
    opacity: shown ? 1 : 0
  }),
  cursorIcon: {
    position: 'absolute',
    top: -3,
    left: -4,
    filter: `drop-shadow(2px 2px 0 ${siteColors.ink})`
  },
  cursorPressed: { transform: 'scale(0.86)' },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 56,
    height: 56,
    borderRadius: '50%',
    borderWidth: 3,
    borderStyle: 'solid',
    borderColor: siteColors.highlight,
    animationName: ripple,
    animationDuration: '500ms',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'forwards'
  }
})
