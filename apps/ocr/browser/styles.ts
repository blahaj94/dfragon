import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex.js'

export const styles = stylex.create({
  root: {
    fontFamily: 'NanumSquareNeo, system-ui, sans-serif',
    fontSize: 14,
    fontSynthesis: 'none',
    color: colors.text,
    backgroundColor: colors.background,
    colorScheme: 'light',
    minHeight: '100vh'
  },
  dark: { colorScheme: 'dark' },
  main: {
    maxWidth: 1440,
    margin: 'auto',
    padding: { default: '30px 48px 48px', '@media (max-width: 760px)': '24px' }
  },
  header: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) auto auto',
      '@media (max-width: 760px)': 'minmax(0, 1fr) auto'
    },
    gridTemplateRows: '24px 48px',
    alignItems: 'center',
    columnGap: 12,
    rowGap: { default: 10, '@media (max-width: 760px)': 14 },
    marginBottom: { default: 26, '@media (max-width: 760px)': 24 }
  },
  brand: { gridColumn: '1 / -1' },
  eyebrow: { fontSize: 12, lineHeight: '24px', color: colors.accent },
  heading: { margin: 0 },
  title: { gridColumn: 1, gridRow: 2 },
  fileActions: {
    display: 'flex',
    alignItems: 'center',
    gap: { default: 12, '@media (max-width: 760px)': 16, '@media (max-width: 420px)': 8 },
    gridColumn: { default: 2, '@media (max-width: 760px)': '1 / -1' },
    gridRow: { default: 2, '@media (max-width: 760px)': 3 },
    marginTop: { default: 0, '@media (max-width: 760px)': 10 }
  },
  accountActions: {
    display: 'flex',
    gap: 12,
    gridColumn: { default: 3, '@media (max-width: 760px)': 2 },
    gridRow: 2
  },
  headerButton: { flexGrow: { default: 0, '@media (max-width: 760px)': 1 } },
  themeButton: { width: 44, padding: 0, flexShrink: 0 },
  paragraph: { lineHeight: 1.5, margin: 0 },
  muted: { color: colors.muted, fontSize: 12, margin: '4px 0 0' },
  actions: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  error: { color: colors.error, margin: '12px 0 24px', overflowWrap: 'anywhere' },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: '20px',
    color: colors.muted,
    minWidth: 0
  },
  splitButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 8
  },
  control: {
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '20px',
    padding: '11px 14px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.inset,
    minWidth: 0,
    width: '100%',
    minHeight: 44,
    color: colors.text,
    outline: { default: null, ':focus-visible': `2px solid ${colors.accent}` },
    outlineOffset: { default: null, ':focus-visible': 2 },
    opacity: { default: 1, ':disabled': 0.5 }
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(4, minmax(0, 1fr))',
      '@media (max-width: 760px)': 'repeat(2, minmax(0, 1fr))'
    },
    gap: 16,
    marginBottom: 28
  },
  statCard: {
    padding: { default: '12px 20px', '@media (max-width: 760px)': '10px 16px' },
    backgroundColor: colors.panel,
    borderRadius: 12,
    minHeight: { default: 88, '@media (max-width: 760px)': 80 }
  },
  statLabel: { fontSize: 12, lineHeight: '20px', color: colors.muted },
  statValue: { display: 'block', marginTop: 4, fontSize: 24, lineHeight: '34px', fontWeight: 600 },
  accent: { color: colors.accent },
  upload: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    padding: 24,
    marginBottom: 28
  },
  uploadHeading: { display: 'flex', alignItems: 'center', gap: 12 },
  uploadHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  uploadParagraph: { fontSize: 14, color: colors.muted, margin: '16px 0 28px' },
  fields: {
    display: 'grid',
    gridTemplateColumns: {
      default: '1.7fr 1fr .85fr 1.25fr',
      '@media (max-width: 1100px)': 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 760px)': 'minmax(0, 1fr)'
    },
    gap: 16
  },
  cropSection: { marginTop: 32 },
  cropDescription: { fontSize: 12, color: colors.muted, margin: '8px 0 20px' },
  cropFields: {
    display: 'grid',
    gridTemplateColumns: {
      default: '136px repeat(4, minmax(0, 1fr))',
      '@media (max-width: 760px)': 'repeat(2, minmax(0, 1fr))'
    },
    gap: { default: 24, '@media (max-width: 760px)': 12 },
    alignItems: 'end',
    marginBottom: 16
  },
  cropPosition: {
    gridColumn: { default: null, '@media (max-width: 760px)': '1 / -1' }
  },
  uploadFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    marginTop: 28,
    paddingTop: 28,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.border
  },
  uploadStatus: { marginTop: 12, color: colors.accent },
  filterBar: { display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 },
  collectionHeading: {
    flexBasis: 246,
    flexShrink: 0,
    display: { default: 'block', '@media (max-width: 760px)': 'none' }
  },
  sampleCount: { display: 'block', marginTop: 8, color: colors.muted, fontSize: 12 },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: { default: 16, '@media (max-width: 420px)': 8 },
    width: { default: 548, '@media (max-width: 760px)': '100%' },
    minWidth: 0
  },
  workspace: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 6fr) minmax(0, 5fr)',
      '@media (max-width: 760px)': 'minmax(0, 1fr)'
    },
    gridTemplateRows: { default: 'min-content 1fr', '@media (max-width: 760px)': 'none' },
    columnGap: 24,
    rowGap: 32,
    alignItems: 'start'
  },
  gallery: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 1100px)': 'repeat(2, minmax(0, 1fr))'
    },
    gap: 16,
    gridColumn: 1,
    gridRow: 1
  },
  sample: {
    textAlign: 'left',
    font: 'inherit',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 10,
    padding: 11,
    minHeight: 164,
    backgroundColor: colors.panel,
    cursor: 'pointer',
    color: colors.text,
    overflow: 'hidden',
    outline: { default: null, ':focus-visible': `2px solid ${colors.accent}` },
    outlineOffset: 2
  },
  selectedSample: {
    borderColor: colors.accent,
    backgroundColor: colors.selected,
    color: colors.accent
  },
  excludedSample: { opacity: 0.65 },
  sampleTitle: {
    display: 'block',
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '24px',
    margin: '10px 4px 4px',
    overflowWrap: 'anywhere'
  },
  sampleMeta: {
    display: 'block',
    fontSize: 12,
    lineHeight: '18px',
    color: colors.muted,
    margin: '0 4px'
  },
  sampleSplit: {
    display: 'block',
    fontSize: 12,
    lineHeight: '18px',
    color: colors.accent,
    margin: '4px 4px 0'
  },
  unassigned: { color: colors.muted },
  thumb: {
    height: 62,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161a20',
    borderRadius: 6,
    overflow: 'hidden'
  },
  thumbnailImage: {
    maxWidth: '100%',
    maxHeight: 48,
    imageRendering: 'pixelated',
    objectFit: 'contain'
  },
  editor: {
    padding: 24,
    backgroundColor: colors.panel,
    borderRadius: 12,
    minWidth: 0,
    gridColumn: { default: 2, '@media (max-width: 760px)': 1 },
    gridRow: { default: '1 / 3', '@media (max-width: 760px)': 2 },
    position: { default: 'sticky', '@media (max-width: 760px)': 'static' },
    top: 24
  },
  editorHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  badge: {
    fontSize: 14,
    color: colors.accent,
    backgroundColor: colors.selected,
    borderRadius: 8,
    padding: '6px 14px',
    whiteSpace: 'nowrap'
  },
  largePreview: {
    backgroundColor: '#161a20',
    height: 104,
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    marginBottom: 18,
    overflow: 'hidden'
  },
  previewImage: { maxWidth: '100%', height: 64, objectFit: 'contain', imageRendering: 'pixelated' },
  editorActions: { margin: '16px 0 24px' },
  metadata: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px 16px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.border,
    paddingTop: 16,
    margin: '24px 0 8px'
  },
  metadataLabel: { fontSize: 12, lineHeight: '18px', color: colors.muted },
  metadataValue: { fontSize: 14, lineHeight: '22px', margin: 0, overflowWrap: 'anywhere' },
  originalLink: { fontSize: 14, lineHeight: '22px', color: colors.accent, textDecoration: 'none' },
  editorStatus: { fontSize: 14, margin: '12px 0 0', color: colors.accent },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    fontSize: 12,
    color: colors.muted,
    gridColumn: 1,
    gridRow: { default: 2, '@media (max-width: 760px)': 3 }
  },
  paginationButton: { minHeight: 36, height: 36, padding: '0 24px' },
  empty: {
    gridColumn: '1 / -1',
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: '70px 24px',
    textAlign: 'center',
    color: colors.muted
  },
  emptyParagraph: { fontSize: 14, margin: '12px 0' },
  login: {
    margin: { default: '84px auto 0', '@media (max-width: 760px)': '60px auto 0' },
    maxWidth: 540,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: { default: '32px 64px 48px', '@media (max-width: 760px)': '32px 24px 48px' },
    textAlign: 'center'
  },
  loginIcon: {
    width: 64,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    backgroundColor: colors.selected,
    color: colors.accent,
    borderRadius: 16
  },
  loginButton: { width: '100%', marginTop: 32, minHeight: 48 },
  serviceAddress: {
    display: 'block',
    textAlign: 'center',
    marginTop: 32,
    color: colors.muted,
    fontSize: 12
  }
})
