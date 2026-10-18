import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  heading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  description: { paddingBlock: 16, color: colors.fgMuted }
})
