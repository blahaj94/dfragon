import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  heading: { paddingBlock: 12, overflowWrap: 'anywhere' },
  description: {
    color: colors.shellMuted,
    paddingBottom: 20,
    overflowWrap: 'anywhere'
  },
  count: { color: colors.shellMuted, paddingTop: 20, paddingBottom: 12 },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    backgroundColor: colors.surface,
    borderRadius: 8
  },
  row: {
    display: { default: 'flex', '@media (max-width: 600px)': 'grid' },
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    width: '100%',
    minHeight: 60,
    height: 'auto',
    justifyContent: 'space-between',
    textAlign: 'left',
    padding: '12px 16px',
    gap: 12,
    color: colors.shellText,
    whiteSpace: 'normal'
  },
  name: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
    overflowWrap: 'anywhere'
  },
  version: { color: colors.shellMuted },
  license: {
    maxWidth: { default: '40%', '@media (max-width: 600px)': '100%' },
    gridColumn: 1,
    gridRow: 2,
    color: colors.shellMuted,
    overflowWrap: 'anywhere'
  },
  rowChevron: { gridColumn: 2, gridRow: '1 / span 2' },
  document: { backgroundColor: colors.surface, borderRadius: 8, padding: 20, marginTop: 16 },
  documentTitle: { paddingBottom: 16, overflowWrap: 'anywhere' },
  original: {
    fontFamily: 'NanumSquareNeo, sans-serif',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    margin: 0
  }
})
