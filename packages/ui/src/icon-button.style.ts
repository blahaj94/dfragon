import * as stylex from '@stylexjs/stylex'
import { colors, radius, size } from './tokens.stylex'

export const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    color: {
      default: colors.fgMuted,
      ':hover:not(:disabled, [aria-pressed="true"])': colors.fgDefault,
      ':disabled:not([aria-pressed="true"])': colors.fgDisabled,
      ':is([aria-pressed="true"])': colors.signal
    },
    boxShadow: { default: null, ':is([aria-pressed="true"])': `inset 0 0 0 2px ${colors.signal}` },
    cursor: { default: 'pointer', ':disabled': 'not-allowed' }
  },
  sm: { width: size.controlSm, height: size.controlSm, fontSize: 16 },
  md: { width: size.controlMd, height: size.controlMd, fontSize: 24 },
  bar: { width: 36, height: 36, fontSize: 20 },
  // 자른 모서리가 바깥 outline을 가리므로 포커스 링은 면 안쪽에 그린다.
  lg: {
    width: size.controlLg,
    height: size.controlLg,
    fontSize: 24,
    borderRadius: radius.panel,
    backgroundColor: colors.bgInset,
    outlineOffset: -4
  },
  icon: { display: 'inline-flex', width: '1em', height: '1em' }
})
