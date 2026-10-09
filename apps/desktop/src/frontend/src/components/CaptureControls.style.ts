import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  // SEED medium iconOnly의 좌우 여백 10에 24 아이콘을 넣으면 폭이 44가 되므로,
  // 디자인 IconButton의 40 정사각형에 맞춰 여백만 줄인다.
  cameraButton: { padding: 8 },
  camera: { color: colors.fgDefault },
  cameraActive: { color: colors.fgBrand },
  dialog: {
    width: 480,
    maxWidth: 'calc(100vw - 32px)',
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 12
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingRight: 24
  },
  notice: {
    color: colors.fgMuted,
    paddingTop: 12,
    overflowWrap: 'anywhere'
  },
  actions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }
})
