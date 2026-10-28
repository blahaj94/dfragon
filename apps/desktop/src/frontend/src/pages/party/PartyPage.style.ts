import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gridTemplateRows: 'minmax(0, 1fr)',
    alignItems: 'stretch',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16
  }
})
