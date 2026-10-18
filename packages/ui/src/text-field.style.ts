import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, size, space } from './tokens.stylex'

export const styles = stylex.create({
  field: { display: 'flex', flexDirection: 'column', gap: space.s4, minWidth: 0 },
  label: { fontSize: 12, lineHeight: '18px', fontWeight: 600, color: colors.fgMuted },
  box: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    paddingInline: space.s12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: colors.borderDefault,
      ':focus-within': colors.signal
    },
    borderRadius: radius.control,
    backgroundColor: colors.bgInset,
    color: colors.fgDefault,
    transitionProperty: 'border-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  // 포커스 색이 오류 색보다 앞서도록 오류 선은 포커스 밖에서만 칠한다.
  invalid: {
    borderColor: { default: colors.borderDanger, ':focus-within': colors.signal }
  },
  disabled: { color: colors.fgDisabled, backgroundColor: colors.bgControl },
  sm: { height: size.controlSm },
  md: { height: size.controlMd },
  lg: { height: size.controlLg },
  input: {
    flexGrow: 1,
    minWidth: 0,
    height: '100%',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    outlineStyle: 'none',
    backgroundColor: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 14,
    '::placeholder': { color: colors.fgPlaceholder }
  },
  description: { margin: 0, fontSize: 12, lineHeight: '18px', color: colors.fgSubtle },
  error: { margin: 0, fontSize: 12, lineHeight: '18px', color: colors.fgDanger }
})
