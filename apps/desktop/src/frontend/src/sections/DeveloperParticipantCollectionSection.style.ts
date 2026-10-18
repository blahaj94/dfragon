import * as stylex from '@stylexjs/stylex'
import { colors, radius } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  section: { display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 },
  connection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 16,
    minHeight: 88,
    boxSizing: 'border-box',
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    flexWrap: 'wrap'
  },
  connectionText: { display: 'flex', flexDirection: 'column', gap: 8 },
  // 연결 상태 점은 디자인 상태 점처럼 사각형이다.
  connectedDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    marginInlineEnd: 8,
    verticalAlign: 'middle',
    backgroundColor: colors.fgSuccess
  },
  heading: { display: 'flex', flexDirection: 'column', gap: 12 },
  muted: { color: colors.fgMuted },
  saveGuide: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: 16,
    minHeight: 88,
    boxSizing: 'border-box',
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface
  },
  keycap: { display: 'flex', flexShrink: 0 },
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
    gap: 12,
    padding: 16,
    boxSizing: 'border-box',
    minWidth: 0,
    minHeight: { default: 372, '@media (max-width: 760px)': 332 },
    backgroundColor: colors.bgSurface,
    borderRadius: radius.panel
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
    borderColor: colors.fgDanger,
    pointerEvents: 'none'
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'center',
    gap: 12,
    color: colors.fgMuted
  },
  legend: { display: 'flex', alignItems: 'center', gap: 8, color: colors.fgMuted },
  swatch: {
    display: 'inline-block',
    width: 20,
    height: 12,
    boxSizing: 'border-box',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: colors.fgDanger
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
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    minWidth: 0
  },
  rowHeader: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: 12,
    minHeight: 20,
    cursor: 'pointer'
  },
  rowHeaderDisabled: { cursor: 'not-allowed' },
  raidRow: { height: 90, padding: '12px 10px' },
  raidRowHeader: { gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 6 },
  rowLabel: { color: colors.fgMuted, textAlign: 'right' },
  cropArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    backgroundColor: colors.bgWell,
    borderRadius: radius.panel,
    overflow: 'hidden'
  },
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
    color: colors.fgMuted,
    marginTop: -8
  },
  notice: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.panel,
    backgroundColor: colors.bgInset,
    color: colors.fgDefault
  }
})
