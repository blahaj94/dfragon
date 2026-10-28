import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  party: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16
  }
})
