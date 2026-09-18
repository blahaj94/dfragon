import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  field: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--seed-dimension-x2)'
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--seed-dimension-x3)'
  },
  status: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontFamily: 'inherit',
    margin: 0
  }
})
