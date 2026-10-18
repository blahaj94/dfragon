import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  field: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.s12
  },
  status: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontFamily: 'inherit',
    margin: 0
  }
})
