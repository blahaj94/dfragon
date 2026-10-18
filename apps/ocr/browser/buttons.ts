import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, shape, size, space } from '@dfragon/ui/tokens.stylex'

// Same rules as the @dfragon/ui Button: primary is a signal surface with the top-right corner
// cut, secondary is a 1px borderStrong outline with the control radius. Call sites append their
// own StyleX class, so padding and margin stay shorthands here and a call-site longhand such as
// paddingInline or marginTop outranks them by StyleX property priority.
const button = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s8,
    flexShrink: 0,
    margin: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    userSelect: 'none',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2,
    transitionProperty: 'color, background-color, border-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  medium: { height: size.controlMd, padding: `0 ${space.s16}`, fontSize: 14 },
  small: { height: size.controlSm, padding: `0 ${space.s12}`, fontSize: 13 },
  primary: {
    borderWidth: 0,
    borderRadius: radius.panel,
    fontWeight: 700,
    color: { default: colors.onSignal, ':disabled': colors.fgDisabled },
    backgroundColor: { default: colors.signal, ':disabled': colors.bgControl },
    clipPath: `polygon(0 0, calc(100% - ${shape.cut}) 0, 100% ${shape.cut}, 100% 100%, 0 100%)`,
    // The cut corner hides an outside outline, so the focus line sits inside the surface.
    outlineColor: colors.onSignal,
    outlineOffset: -4
  },
  secondary: {
    color: { default: colors.fgDefault, ':disabled': colors.fgDisabled },
    borderColor: { default: colors.borderStrong, ':disabled': colors.borderDefault },
    backgroundColor: { default: 'transparent', ':hover:not(:disabled)': colors.bgControlHover }
  }
})

// Shape and type only; the screen supplies chip colors and the selected state in one
// stylex.props call so those rules merge in order.
const chipParts = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: size.controlSm,
    padding: `0 ${space.s12}`,
    borderWidth: 0,
    borderRadius: radius.control,
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2,
    transitionProperty: 'color, background-color, box-shadow',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  label: { color: 'inherit', fontWeight: 'inherit' }
})

export const primary = stylex.props(button.base, button.medium, button.primary).className
export const secondary = stylex.props(button.base, button.medium, button.secondary).className
export const secondarySmall = stylex.props(button.base, button.small, button.secondary).className
export const chip = {
  root: stylex.props(chipParts.root).className,
  label: stylex.props(chipParts.label).className
}
