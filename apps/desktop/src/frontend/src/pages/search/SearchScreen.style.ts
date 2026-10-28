import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBlock: space.s12,
    paddingInline: space.s16
  },
  page: { display: 'flex', flexDirection: 'column', minHeight: '100%', gap: space.s16 }
})
