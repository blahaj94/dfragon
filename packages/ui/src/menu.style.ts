import * as stylex from '@stylexjs/stylex'
import { space } from './tokens.stylex'

export const styles = stylex.create({
  item: { height: 32, paddingInline: space.s16, fontSize: 14 }
})
