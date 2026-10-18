import * as stylex from '@stylexjs/stylex'
import { colors, radius } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  notice: {
    position: 'sticky',
    top: 8,
    zIndex: 2,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    // 테두리 없이 면으로 구분하고 왼쪽 띠 색으로 상태를 보인다.
    borderWidth: 0,
    borderLeftWidth: 5,
    borderStyle: 'solid',
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    minWidth: 0
  },
  idle: { borderColor: colors.borderDefault },
  busy: { borderColor: colors.fgMuted },
  success: { borderColor: colors.fgSuccess },
  warning: { borderColor: colors.fgSubtle },
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
