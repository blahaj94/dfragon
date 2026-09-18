import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  root: {
    position: 'relative',
    display: 'block',
    overflow: 'hidden',
    width: 0,
    minWidth: '3em',
    height: 24,
    transitionProperty: 'min-width',
    transitionDuration: { default: '360ms', '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
  },
  compact: { minWidth: 24 },
  text: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '3em',
    whiteSpace: 'nowrap',
    transform: 'translateX(0)',
    opacity: 1,
    transitionProperty: 'transform, opacity',
    transitionDuration: { default: '360ms', '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
  },
  textHidden: { transform: 'translateX(100%)', opacity: 0 },
  // Both layers are out of flow, so the hidden spinner adds no width to the label.
  icon: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'translateX(100%)',
    opacity: 0,
    transitionProperty: 'transform, opacity',
    transitionDuration: { default: '360ms', '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
  },
  iconShown: { transform: 'translateX(0)', opacity: 1 }
})
