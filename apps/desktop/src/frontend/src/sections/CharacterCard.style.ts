import * as stylex from '@stylexjs/stylex'
import { colors, motion } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  card: {
    position: 'relative',
    height: 280,
    boxSizing: 'border-box',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.cardBorder,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    color: colors.cardFg,
    overflow: 'hidden',
    transitionProperty: 'height',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  // 접힌 카드는 아래쪽에 붙은 서버, 이름, 모험단, 명성만 남긴다. 카드 디자인 적용 전의 임시 높이다.
  collapsed: { height: 168 },
  failure: { borderWidth: 2, borderStyle: 'solid', borderColor: colors.borderDanger },
  turn: {
    position: 'absolute',
    inset: 0,
    borderWidth: 0,
    borderRadius: 11,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    outlineOffset: -4,
    ':focus-visible': { outline: `2px solid ${colors.cardSignal}` },
    ':hover': { boxShadow: `inset 0 0 0 1px ${colors.cardBorderStrong}` }
  },
  content: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  progress: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' },
  portrait: {
    position: 'absolute',
    inset: '10px 12px 50px',
    opacity: 1,
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: 'linear'
  },
  // 접을 때 사라지는 부분의 불투명도는 motion.md의 예외대로 120ms 직선으로 줄인다.
  portraitCollapsed: { opacity: 0, visibility: 'hidden' },
  identity: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    textAlign: 'center',
    display: 'grid',
    gap: 2
  },
  adventure: { color: colors.cardFgAdventure, paddingBottom: 28 },
  fame: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    color: colors.cardFg
  },
  muted: { color: colors.cardFgMuted },
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
    borderColor: colors.cardBorder,
    borderRadius: 4,
    backgroundColor: colors.cardInset,
    color: colors.cardFg,
    fontFamily: 'inherit',
    outlineOffset: 2,
    ':focus-visible': { outline: `2px solid ${colors.cardSignal}` }
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
    borderRadius: 8,
    backgroundColor: colors.cardControl,
    color: colors.cardFg,
    cursor: 'pointer',
    ':focus-visible': { outline: `2px solid ${colors.cardSignal}` },
    ':disabled': { opacity: 0.35, cursor: 'default' }
  },
  status: {
    position: 'absolute',
    top: '43%',
    left: 10,
    right: 10,
    textAlign: 'center',
    color: colors.cardFgMuted
  },
  error: { color: colors.fgDanger },
  statusWhileLoading: { top: '58%' },
  selectedNotice: { top: 48, fontSize: 11 },
  statusWithRetry: { top: '28%' },
  retry: {
    position: 'absolute',
    bottom: 85,
    left: 10,
    right: 10,
    display: 'flex',
    justifyContent: 'center'
  },
  editing: {
    position: 'absolute',
    top: 45,
    left: 12,
    right: 12,
    color: colors.cardFgMuted,
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
