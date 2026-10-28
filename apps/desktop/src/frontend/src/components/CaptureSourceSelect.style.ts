import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const fill = stylex.keyframes({
  from: { transform: 'scaleX(0)' },
  to: { transform: 'scaleX(1)' }
})

export const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'stretch',
    gap: space.s8,
    height: 44,
    overflowX: 'auto',
    overflowY: 'hidden',
    // 포커스 링이 타일 안쪽에 그려지므로 넘침을 잘라도 가려지지 않는다.
    scrollbarWidth: 'thin'
  },
  group: { display: 'flex', alignItems: 'stretch', gap: space.s8 },
  tile: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    flex: '1 1 0',
    minWidth: 140,
    maxWidth: 220,
    boxSizing: 'border-box',
    paddingInline: space.s12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault
  },
  sourceTile: { flexShrink: 0 },
  selectedTile: {
    backgroundImage: `linear-gradient(${colors.bgControl}, ${colors.bgControl})`,
    boxShadow: `inset 2px 0 0 ${colors.signal}`
  },
  disabledTile: { opacity: 0.4 },
  radio: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    appearance: 'none',
    backgroundColor: 'transparent',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: -2
  },
  text: { display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 },
  name: {
    overflow: 'hidden',
    color: colors.fgDefault,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: '16px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  selectedName: { color: colors.signal },
  line: { fontSize: 12, lineHeight: '14px', color: colors.fgMuted },
  check: { width: 16, height: 16, flexShrink: 0, color: colors.signal },
  failureTile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 0,
    flexShrink: 0,
    borderColor: colors.borderDanger
  },
  failureTitle: { fontSize: 12, lineHeight: '16px', fontWeight: 700, color: colors.fgDanger },
  searchingTile: {
    flexShrink: 0,
    overflow: 'hidden',
    borderStyle: 'dashed',
    borderColor: colors.fgWarning
  },
  searching: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: '16px',
    color: colors.fgWarning
  },
  retryTrack: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    display: 'block',
    height: 2,
    overflow: 'hidden',
    backgroundColor: colors.borderDefault
  },
  retryBar: {
    display: 'block',
    height: '100%',
    backgroundColor: colors.fgWarning,
    transformOrigin: 'left',
    animationName: fill,
    animationTimingFunction: 'linear',
    animationFillMode: 'both',
    animationPlayState: { default: 'running', '@media (prefers-reduced-motion: reduce)': 'paused' }
  },
  retryTiming: (duration: string, delay: string) => ({
    animationDuration: duration,
    animationDelay: delay
  })
})
