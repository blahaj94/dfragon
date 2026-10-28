import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, space } from './tokens.stylex'

export const styles = stylex.create({
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    backgroundColor: colors.bgOverlay,
    opacity: { default: 1, ':is([data-starting-style], [data-ending-style])': 0 },
    transitionProperty: 'opacity',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  popup: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: space.s16,
    boxSizing: 'border-box',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100dvh - 32px)',
    padding: space.s24,
    overflow: 'auto',
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    transform: 'translate(-50%, -50%)',
    opacity: { default: 1, ':is([data-starting-style], [data-ending-style])': 0 },
    transitionProperty: 'opacity',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease,
    outlineStyle: 'none'
  },
  sm: { width: 480 },
  lg: { width: 800, height: 600 },
  header: { display: 'flex', alignItems: 'flex-start', gap: space.s12 },
  heading: { display: 'flex', flexDirection: 'column', flexGrow: 1, gap: space.s4, minWidth: 0 },
  title: { margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 700 },
  description: { margin: 0, fontSize: 14, lineHeight: '20px', color: colors.fgMuted },
  close: { marginTop: -8, marginInlineEnd: -8 },
  body: { display: 'flex', flexDirection: 'column', gap: space.s12, minHeight: 0 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: space.s8 }
})
