import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'

export const styles = stylex.create({
  header: {
    minHeight: 72,
    color: colors.fgDefault,
    paddingInline: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    marginBottom: 16
  },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
  // SEED medium iconOnly의 좌우 여백 10에 24 아이콘을 넣으면 폭이 44가 되므로,
  // 상단 바의 카메라, 설정 버튼과 같은 40 정사각형에 맞춰 여백만 줄인다.
  iconButton: { padding: 8 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
    gap: 12,
    padding: 16,
    backgroundColor: colors.bgCanvas,
    borderRadius: 12
  }
})
