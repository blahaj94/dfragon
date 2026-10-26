import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  notice: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 16px',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    borderLeftColor: colors.signal,
    borderRadius: 8,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault
  },
  message: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  actions: { display: 'flex', alignItems: 'center', gap: 8 }
})
