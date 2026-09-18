import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  root: { display: 'inline-flex', alignItems: 'center', height: 24 },
  // The two clipping edges meet at the invisible wall; neither layer crosses it visibly.
  textMask: { overflow: 'hidden', width: '3.5em', whiteSpace: 'nowrap' },
  text: {
    display: 'block',
    textAlign: 'center',
    transform: 'translateX(0)',
    transitionProperty: 'transform',
    transitionDuration: { default: '360ms', '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    transitionDelay: { default: '80ms', '@media (prefers-reduced-motion: reduce)': '0ms' }
  },
  textHidden: { transform: 'translateX(100%)', transitionDelay: '0ms' },
  iconMask: { overflow: 'hidden', width: 24, height: 24 },
  icon: {
    display: 'flex',
    transform: 'translateX(-100%)',
    opacity: 0,
    transitionProperty: 'transform, opacity',
    transitionDuration: { default: '360ms', '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    transitionDelay: '0ms'
  },
  iconShown: {
    transform: 'translateX(0)',
    opacity: 1,
    transitionDelay: { default: '80ms', '@media (prefers-reduced-motion: reduce)': '0ms' }
  }
})
