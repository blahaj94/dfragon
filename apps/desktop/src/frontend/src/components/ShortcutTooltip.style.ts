import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  label: { display: 'block', textAlign: 'center' },
  shortcut: { display: 'block', textAlign: 'center', color: colors.fgMuted }
})
