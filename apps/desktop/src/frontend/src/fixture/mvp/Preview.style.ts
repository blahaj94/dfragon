import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'

export const styles = stylex.create({
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault
  },
  // OS 창 버튼은 창 위쪽에 고정되므로 상단 바도 고정하고 그 아래 내용만 스크롤한다.
  content: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px' },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    marginTop: 16,
    fontSize: 12,
    color: colors.fgMuted
  },
  select: {
    maxWidth: '100%',
    padding: 6,
    fontFamily: 'inherit',
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 6
  },
  notice: { fontSize: 12, lineHeight: 1.6, color: colors.fgMuted, margin: '12px 0 0' }
})
