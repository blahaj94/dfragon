import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex.js'

export const layout = stylex.create({
  fields: { display: 'flex', flexWrap: 'wrap', gap: 16, marginBlock: 16 },
  field: { display: 'grid', gap: 6 },
  input: { width: 110 },
  scroll: { overflowX: 'auto', marginBlock: 16 },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  cell: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.border,
    whiteSpace: 'nowrap'
  },
  frequencies: { maxHeight: 180, overflowY: 'auto', lineHeight: 2, wordBreak: 'break-all' }
})
