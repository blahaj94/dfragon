import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 24,
    paddingBlock: 16,
    color: colors.shellText,
    flexWrap: 'wrap'
  },
  name: { fontSize: 28, margin: '0 0 12px', fontWeight: 700 },
  server: {
    fontSize: 12,
    padding: '5px 12px',
    backgroundColor: colors.control,
    borderRadius: 6,
    marginLeft: 24,
    verticalAlign: 'middle'
  },
  subtitle: { fontSize: 13, color: colors.muted, margin: 0 },
  scores: { display: 'flex', gap: 48, margin: 0, alignItems: 'center', paddingRight: 24 },
  label: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  score: { fontSize: 28, fontWeight: 700, margin: 0 },
  fame: { color: colors.accent },
  scroll: { overflowX: 'auto', paddingBottom: 0 },
  deck: { position: 'relative', minWidth: 1072, height: 512, marginTop: 4 },
  card: (rank: number) => ({
    position: 'absolute',
    width: 736,
    height: 480,
    boxSizing: 'border-box',
    left: rank * 84,
    top: rank * 8,
    zIndex: 5 - rank,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: rank === 0 ? colors.card : colors.alternate,
    transitionProperty: 'left, top, background-color',
    transitionDuration: { default: '180ms', '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: 'ease-out',
    color: colors.text
  }),
  selector: (selected: boolean) => ({
    position: 'absolute',
    inset: 0,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: colors.text,
    cursor: selected ? 'default' : 'pointer',
    textAlign: 'right',
    padding: 0,
    ':focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: -4 }
  }),
  tabLabel: {
    position: 'absolute',
    top: 24,
    right: 0,
    width: 84,
    textAlign: 'center',
    fontSize: 13
  },
  number: {
    position: 'absolute',
    bottom: 30,
    right: 0,
    width: 84,
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, position: 'absolute', top: 20, left: 20 },
  content: { position: 'absolute', inset: '68px 20px 20px', pointerEvents: 'none' },
  identity: { textAlign: 'center', marginTop: 12 },
  adventure: { fontSize: 12, color: colors.adventure },
  characterName: { margin: '8px 0', fontSize: 20, fontWeight: 700 },
  pending: {
    display: 'grid',
    placeContent: 'center',
    height: '100%',
    textAlign: 'center',
    gap: 12,
    color: colors.muted,
    fontSize: 14
  },
  note: { margin: '12px 0 0', color: colors.muted, fontSize: 12, textAlign: 'center' }
})
