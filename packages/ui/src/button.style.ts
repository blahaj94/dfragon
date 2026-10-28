import * as stylex from '@stylexjs/stylex'
import { colors, radius, size, space } from './tokens.stylex'

export const styles = stylex.create({
  root: {
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
    userSelect: 'none'
  },
  sm: { height: size.controlSm, paddingInline: space.s12, fontSize: 13 },
  md: { height: size.controlMd, paddingInline: space.s16, fontSize: 14 },
  lg: { height: size.controlLg, paddingInline: space.s24, fontSize: 16 },
  primary: {
    borderRadius: radius.panel,
    borderWidth: 0,
    fontWeight: 700,
    color: { default: colors.onSignal, ':disabled': colors.fgDisabled },
    backgroundColor: { default: colors.signal, ':disabled': colors.bgControl },
    // 자른 모서리가 바깥 outline을 가리므로 면 안쪽에 글자색 선을 그린다.
    outlineColor: colors.onSignal,
    outlineOffset: -4
  },
  secondary: {
    color: { default: colors.fgDefault, ':disabled': colors.fgDisabled },
    borderColor: { default: colors.borderStrong, ':disabled': colors.borderDefault },
    backgroundColor: { default: 'transparent', ':hover:not(:disabled)': colors.bgControlHover }
  },
  ghost: {
    color: {
      default: colors.fgMuted,
      ':hover:not(:disabled)': colors.fgDefault,
      ':disabled': colors.fgDisabled
    }
  },
  danger: {
    color: { default: colors.fgDanger, ':disabled': colors.fgDisabled },
    borderColor: { default: colors.borderDanger, ':disabled': colors.borderDefault },
    backgroundColor: { default: 'transparent', ':hover:not(:disabled)': colors.bgDangerWeak }
  }
})
