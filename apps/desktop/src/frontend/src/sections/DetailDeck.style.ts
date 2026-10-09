import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 24,
    paddingBlock: 16,
    color: colors.fgDefault,
    flexWrap: 'wrap'
  },
  name: { paddingBottom: 12, display: 'flex', alignItems: 'center', gap: 24 },
  server: {
    padding: '5px 12px',
    backgroundColor: colors.bgControl,
    borderRadius: 6,
    verticalAlign: 'middle'
  },
  subtitle: { color: colors.fgMuted, margin: 0 },
  scores: { display: 'flex', gap: 48, margin: 0, alignItems: 'center', paddingRight: 24 },
  label: { color: colors.fgMuted, paddingBottom: 8 },
  score: { margin: 0 },
  fame: { color: colors.fgBrand },
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
    borderColor: colors.cardBorder,
    borderRadius: 12,
    backgroundColor: rank === 0 ? colors.cardBg : colors.cardStripe,
    transitionProperty: 'left, top, background-color',
    transitionDuration: { default: '180ms', '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: 'ease-out',
    color: colors.cardFg
  }),
  selector: (selected: boolean) => ({
    position: 'absolute',
    inset: 0,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: colors.cardFg,
    cursor: selected ? 'default' : 'pointer',
    textAlign: 'right',
    padding: 0,
    ':focus-visible': { outline: `2px solid ${colors.borderFocus}`, outlineOffset: -4 }
  }),
  tabLabel: {
    position: 'absolute',
    top: 24,
    right: 0,
    width: 84,
    textAlign: 'center'
  },
  number: {
    position: 'absolute',
    bottom: 30,
    right: 0,
    width: 84,
    textAlign: 'center',
    color: colors.cardFgMuted
  },
  title: { margin: 0, position: 'absolute', top: 20, left: 20 },
  content: { position: 'absolute', inset: '68px 20px 20px', pointerEvents: 'none' },
  identity: { textAlign: 'center', marginTop: 12 },
  adventure: { color: colors.cardFgAdventure },
  characterName: { paddingBlock: 8 },
  pending: {
    display: 'grid',
    placeContent: 'center',
    height: '100%',
    textAlign: 'center',
    gap: 12,
    color: colors.cardFgMuted
  },
  note: { paddingTop: 12, color: colors.cardFgMuted, textAlign: 'center' }
})
