import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex.js'

export const styles = stylex.create({
  root: {
    fontSize: 14,
    fontSynthesis: 'none',
    color: colors.fgDefault,
    backgroundColor: colors.bgCanvas,
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
  eyebrow: { fontSize: 12, lineHeight: '24px', color: colors.fgBrand },
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
  themeButton: { width: 40, padding: 0, flexShrink: 0 },
  paragraph: { lineHeight: 1.5, margin: 0 },
  muted: { color: colors.fgSubtle, fontSize: 12, margin: '4px 0 0' },
  actions: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  error: { color: colors.fgDanger, margin: '12px 0 24px', overflowWrap: 'anywhere' },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: '20px',
    color: colors.fgSubtle,
    minWidth: 0
  },
  splitButtons: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  // StyleX rules outrank the SEED chip recipe, so restate its disabled colors and focus ring.
  chip: {
    backgroundColor: { default: colors.bgControl, ':disabled': 'var(--seed-color-bg-disabled)' },
    boxShadow: 'none',
    outline: { default: null, ':focus-visible': `2px solid ${colors.borderFocus}` },
    outlineOffset: { default: null, ':focus-visible': 2 }
  },
  selectedChip: {
    backgroundColor: { default: colors.bgBrandWeak, ':disabled': 'var(--seed-color-bg-disabled)' },
    color: { default: colors.fgBrand, ':disabled': 'var(--seed-color-fg-disabled)' },
    boxShadow: `inset 0 0 0 1px ${colors.borderBrand}`,
    fontWeight: 700
  },
  control: {
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '20px',
    padding: '9px 14px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 8,
    backgroundColor: colors.bgInset,
    minWidth: 0,
    width: '100%',
    height: 40,
    color: colors.fgDefault,
    outline: { default: null, ':focus-visible': `2px solid ${colors.borderFocus}` },
    outlineOffset: { default: null, ':focus-visible': -1 },
    opacity: { default: 1, ':disabled': 0.5 },
    '::placeholder': { color: colors.fgPlaceholder }
  },
  select: { backgroundColor: colors.bgControl, borderColor: 'transparent' },
  fileInput: {
    paddingBlock: 5,
    paddingInlineStart: 5,
    '::file-selector-button': {
      font: 'inherit',
      fontWeight: 700,
      color: colors.fgDefault,
      backgroundColor: colors.bgControl,
      borderWidth: 0,
      borderRadius: 6,
      padding: '4px 12px',
      marginInlineEnd: 12,
      cursor: 'pointer'
    }
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
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 12,
    minHeight: { default: 88, '@media (max-width: 760px)': 80 }
  },
  statLabel: { fontSize: 12, lineHeight: '20px', color: colors.fgSubtle },
  statValue: { display: 'block', marginTop: 4, fontSize: 24, lineHeight: '34px', fontWeight: 600 },
  accent: { color: colors.fgBrand },
  upload: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 12,
    padding: 24,
    marginBottom: 28
  },
  uploadHeading: { display: 'flex', alignItems: 'center', gap: 12 },
  uploadHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  uploadParagraph: { fontSize: 14, color: colors.fgMuted, margin: '16px 0 28px' },
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
  cropDescription: { fontSize: 12, color: colors.fgSubtle, margin: '8px 0 20px' },
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
    borderTopColor: colors.borderDefault
  },
  uploadStatus: { marginTop: 12, color: colors.fgBrand },
  failedStatus: { color: colors.fgDanger },
  filterBar: { display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 },
  collectionHeading: {
    flexBasis: 246,
    flexShrink: 0,
    display: { default: 'block', '@media (max-width: 760px)': 'none' }
  },
  sampleCount: { display: 'block', marginTop: 8, color: colors.fgSubtle, fontSize: 12 },
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
    borderColor: colors.borderDefault,
    borderRadius: 10,
    padding: 11,
    minHeight: 164,
    backgroundColor: colors.bgSurface,
    cursor: 'pointer',
    color: colors.fgDefault,
    overflow: 'hidden',
    outline: { default: null, ':focus-visible': `2px solid ${colors.borderFocus}` },
    outlineOffset: 2
  },
  selectedSample: {
    borderColor: colors.borderBrand,
    backgroundColor: colors.bgBrandWeak,
    color: colors.fgBrand
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
  labeledTitle: { fontWeight: 700 },
  sampleMeta: {
    display: 'block',
    fontSize: 12,
    lineHeight: '18px',
    color: colors.fgMuted,
    margin: '0 4px'
  },
  sampleSplit: {
    display: 'block',
    fontSize: 12,
    lineHeight: '18px',
    color: colors.fgBrand,
    margin: '4px 4px 0'
  },
  unassigned: { color: colors.fgMuted },
  excludedSplit: { color: colors.fgDanger },
  thumb: {
    height: 62,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgPreview,
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
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
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
    color: colors.fgDefault,
    backgroundColor: colors.bgControl,
    borderRadius: 9999,
    padding: '6px 14px',
    whiteSpace: 'nowrap'
  },
  largePreview: {
    backgroundColor: colors.bgPreview,
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
    borderTopColor: colors.borderDefault,
    paddingTop: 16,
    margin: '24px 0 8px'
  },
  metadataLabel: { fontSize: 12, lineHeight: '18px', color: colors.fgSubtle },
  metadataValue: { fontSize: 14, lineHeight: '22px', margin: 0, overflowWrap: 'anywhere' },
  originalLink: { fontSize: 14, lineHeight: '22px', color: colors.fgBrand, textDecoration: 'none' },
  editorStatus: { fontSize: 14, margin: '12px 0 0', color: colors.fgBrand },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    fontSize: 12,
    color: colors.fgSubtle,
    gridColumn: 1,
    gridRow: { default: 2, '@media (max-width: 760px)': 3 }
  },
  empty: {
    gridColumn: '1 / -1',
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    padding: '70px 24px',
    textAlign: 'center',
    color: colors.fgMuted
  },
  emptyParagraph: { fontSize: 14, margin: '12px 0' },
  login: {
    margin: { default: '84px auto 0', '@media (max-width: 760px)': '60px auto 0' },
    maxWidth: 540,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
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
    backgroundColor: colors.bgBrandWeak,
    color: colors.fgBrand,
    borderRadius: 16
  },
  loginButton: { width: '100%', marginTop: 32 },
  serviceAddress: {
    display: 'block',
    textAlign: 'center',
    marginTop: 32,
    color: colors.fgSubtle,
    fontSize: 12
  }
})
