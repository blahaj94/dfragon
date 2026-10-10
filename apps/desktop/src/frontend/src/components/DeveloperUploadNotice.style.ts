import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  notice: {
    position: 'sticky',
    top: 8,
    zIndex: 2,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderStyle: 'solid',
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    minWidth: 0
  },
  idle: { borderColor: colors.borderDefault },
  busy: { borderColor: colors.fgInfo },
  success: { borderColor: colors.fgSuccess },
  warning: { borderColor: colors.fgWarning },
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    minHeight: 28,
    flexShrink: 0,
    fontSize: 24,
    fontWeight: 700
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
    overflowWrap: 'anywhere'
  },
  metadata: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', color: colors.fgMuted }
})
