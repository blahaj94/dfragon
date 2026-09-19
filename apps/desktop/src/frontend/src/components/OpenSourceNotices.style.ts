import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  heading: { fontSize: 22, lineHeight: 1.4, margin: '12px 0', overflowWrap: 'anywhere' },
  description: {
    fontSize: 13,
    color: colors.shellMuted,
    lineHeight: 1.6,
    margin: '0 0 20px',
    overflowWrap: 'anywhere'
  },
  count: { fontSize: 11, color: colors.shellMuted, margin: '20px 0 12px' },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    backgroundColor: colors.surface,
    borderRadius: 8
  },
  row: {
    display: 'flex',
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
    fontSize: 13,
    overflowWrap: 'anywhere'
  },
  version: { fontSize: 10, fontWeight: 400, color: colors.shellMuted },
  license: {
    maxWidth: '40%',
    fontSize: 11,
    fontWeight: 400,
    color: colors.shellMuted,
    overflowWrap: 'anywhere'
  },
  document: { backgroundColor: colors.surface, borderRadius: 8, padding: 20, marginTop: 16 },
  documentTitle: { margin: '0 0 16px', fontSize: 13, overflowWrap: 'anywhere' },
  original: {
    fontFamily: 'NanumSquareNeo, sans-serif',
    fontSize: 12,
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    margin: 0
  }
})
