import * as stylex from '@stylexjs/stylex'
import { colors } from './constants/theme.stylex'

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
  workbench: { minHeight: '100%' },
  brand: { display: 'flex', alignItems: 'center', gap: 8 },
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
    color: colors.fgMuted
  }
})
