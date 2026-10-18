import * as stylex from '@stylexjs/stylex'
import { colors, space } from './tokens.stylex'

export const styles = stylex.create({
  stack: { display: 'flex', flexDirection: 'column', gap: space.s24 },
  heading: { margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 600 },
  supporting: { margin: 0, fontSize: 14, lineHeight: '20px', color: colors.fgMuted }
})
