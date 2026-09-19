import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  card: {
    position: 'relative',
    height: 280,
    boxSizing: 'border-box',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    color: colors.text,
    overflow: 'hidden'
  },
  failure: { borderWidth: 2, borderStyle: 'solid', borderColor: '#ff535b' },
  turn: {
    position: 'absolute',
    inset: 0,
    borderWidth: 0,
    borderRadius: 11,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    outlineOffset: -4,
    ':focus-visible': { outline: `2px solid ${colors.accent}` },
    ':hover': { boxShadow: 'inset 0 0 0 1px #8795a8' }
  },
  content: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  portrait: { position: 'absolute', inset: '10px 12px 50px', opacity: 1 },
  identity: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    textAlign: 'center',
    display: 'grid',
    gap: 2
  },
  adventure: { color: colors.adventure, paddingBottom: 28 },
  fame: { color: colors.accent },
  muted: { color: colors.muted },
  equipment: {
    position: 'absolute',
    inset: '48px 11px 48px',
    display: 'grid',
    alignItems: 'center'
  },
  investment: { position: 'absolute', inset: '42px 5px 6px' },
  input: {
    position: 'absolute',
    bottom: 48,
    left: 11,
    width: 'calc(100% - 22px)',
    boxSizing: 'border-box',
    height: 26,
    padding: 0,
    textAlign: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.input,
    color: colors.text,
    fontFamily: 'inherit',
    outlineOffset: 2,
    ':focus-visible': { outline: '2px solid #f57424' }
  },
  serverAnchor: {
    position: 'absolute',
    top: 11,
    left: 11,
    maxWidth: 'calc(100% - 60px)'
  },
  detail: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    borderWidth: 0,
    borderRadius: 6,
    backgroundColor: colors.control,
    color: colors.text,
    cursor: 'pointer',
    ':focus-visible': { outline: `2px solid ${colors.accent}` },
    ':disabled': { opacity: 0.35, cursor: 'default' }
  },
  status: {
    position: 'absolute',
    top: '43%',
    left: 10,
    right: 10,
    textAlign: 'center',
    color: colors.muted
  },
  error: { color: '#ff8888' },
  editing: {
    position: 'absolute',
    top: 45,
    left: 12,
    right: 12,
    color: colors.muted,
    textAlign: 'center'
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap'
  }
})
