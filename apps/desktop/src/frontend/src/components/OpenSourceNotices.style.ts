import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  heading: { paddingBlock: 12, overflowWrap: 'anywhere' },
  description: {
    color: colors.fgMuted,
    paddingBottom: 20,
    overflowWrap: 'anywhere'
  },
  // Design TextField focus is a 2px border.focus line. The shared TextField does not take a
  // className, and SEED draws its focus line with this stroke token, so the wrapper scope
  // points the token at border.focus.
  search: { '--seed-color-stroke-neutral-contrast': colors.borderFocus },
  count: { color: colors.fgMuted, paddingTop: 20, paddingBottom: 12 },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  // The design table counts its header row, so its bg.stripe rows are the first, third and
  // following odd entries of this header-less list.
  item: {
    borderRadius: 4,
    backgroundColor: { default: null, ':nth-child(odd)': colors.bgStripe }
  },
  // Design two-line row is 48: a 16/24 name over a 12/18 line with 3px above and below.
  row: {
    display: { default: 'flex', '@media (max-width: 600px)': 'grid' },
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    height: 'auto',
    justifyContent: 'space-between',
    textAlign: 'left',
    paddingBlock: 3,
    paddingInline: 12,
    gap: 12,
    borderRadius: 4,
    color: colors.fgDefault,
    whiteSpace: 'normal'
  },
  name: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    overflowWrap: 'anywhere'
  },
  version: { color: colors.fgMuted },
  license: {
    maxWidth: { default: '40%', '@media (max-width: 600px)': '100%' },
    gridColumn: 1,
    gridRow: 2,
    color: colors.fgMuted,
    overflowWrap: 'anywhere'
  },
  rowChevron: {
    gridColumn: 2,
    gridRow: '1 / span 2',
    flexShrink: 0,
    width: 24,
    height: 24,
    color: colors.fgSubtle
  },
  document: { backgroundColor: colors.bgInset, borderRadius: 12, padding: 16, marginTop: 16 },
  documentTitle: { paddingBottom: 16, overflowWrap: 'anywhere' },
  original: {
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    margin: 0
  }
})
