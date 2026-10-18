import * as stylex from '@stylexjs/stylex'
import { font } from './tokens.stylex'

export const styles = stylex.create({
  root: { fontFamily: font.num, fontVariantNumeric: 'tabular-nums' }
})
