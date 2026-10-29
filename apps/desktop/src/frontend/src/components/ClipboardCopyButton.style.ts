import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 자른 모서리가 바깥 outline을 가리므로 포커스 링은 면 안쪽에 그린다.
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 28,
    height: 28,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: colors.bgInset,
    boxShadow: `inset 0 0 0 1px ${colors.signal}`,
    color: colors.signal,
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: -4
  },
  failure: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    minWidth: 0,
    margin: 0,
    fontSize: 12,
    lineHeight: '14px',
    color: colors.fgMuted,
    whiteSpace: 'nowrap'
  },
  failureMark: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 18,
    height: 18,
    fontFamily: font.num,
    fontSize: 14,
    fontWeight: 700,
    backgroundColor: colors.bgDangerWeak,
    color: colors.fgDanger
  },
  failureText: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }
})
