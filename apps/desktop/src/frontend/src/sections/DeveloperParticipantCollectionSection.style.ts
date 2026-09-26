import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  section: { display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 },
  connection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '16px 20px',
    minHeight: 88,
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.collectionBorder,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexWrap: 'wrap'
  },
  connectionText: { display: 'flex', flexDirection: 'column', gap: 8 },
  badge: {
    color: colors.collectionAccentText,
    backgroundColor: colors.collectionAccentSurface,
    padding: '7px 12px',
    borderRadius: 6
  },
  heading: { display: 'flex', flexDirection: 'column', gap: 12 },
  muted: { color: colors.shellMuted },
  saveGuide: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '16px 20px',
    minHeight: 88,
    boxSizing: 'border-box',
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.collectionBorder
  },
  keycap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 112,
    height: 40,
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.collectionBorder,
    backgroundColor: colors.collectionSurface,
    borderRadius: 4,
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 700
  },
  guideText: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  previews: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1.27fr) minmax(0, 1fr)',
      '@media (max-width: 760px)': 'minmax(0, 1fr)'
    },
    gap: 20
  },
  windowPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '20px 24px',
    boxSizing: 'border-box',
    minWidth: 0,
    minHeight: { default: 372, '@media (max-width: 760px)': 332 },
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.collectionBorder,
    borderRadius: 12
  },
  windowArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0
  },
  windowHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap'
  },
  windowImage: { position: 'relative', width: '100%', maxWidth: 640 },
  dialog: { display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated' },
  outline: {
    position: 'absolute',
    boxSizing: 'border-box',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#f56c00',
    pointerEvents: 'none'
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'center',
    gap: 12,
    color: colors.shellMuted
  },
  legend: { display: 'flex', alignItems: 'center', gap: 8, color: colors.shellMuted },
  swatch: {
    display: 'inline-block',
    width: 20,
    height: 12,
    boxSizing: 'border-box',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#f56c00'
  },
  rows: { display: 'flex', flexDirection: 'column', gap: 12 },
  raidRows: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 380px)': 'minmax(0, 1fr)'
    },
    gap: '10px 12px'
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    height: 84,
    boxSizing: 'border-box',
    padding: '10px 16px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.collectionBorder,
    borderRadius: 12,
    backgroundColor: colors.surface,
    minWidth: 0
  },
  rowHeader: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: 12,
    minHeight: 20
  },
  raidRow: { height: 90, padding: '12px 10px' },
  raidRowHeader: { gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 6 },
  rowLabel: { color: colors.shellMuted, textAlign: 'right' },
  checkbox: { margin: 0, width: 18, height: 18, accentColor: '#f56c00', flexShrink: 0 },
  cropArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    backgroundColor: '#101216',
    borderRadius: 4,
    overflow: 'hidden'
  },
  emptyArea: { backgroundColor: colors.collectionSurface },
  cropImage: {
    display: 'block',
    height: 30,
    maxWidth: '100%',
    objectFit: 'contain',
    imageRendering: 'pixelated'
  },
  unchecked: { opacity: 0.32 },
  footnotes: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    color: colors.shellMuted,
    marginTop: -8
  },
  notice: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.collectionAccentSurface,
    color: colors.collectionAccentText
  }
})
