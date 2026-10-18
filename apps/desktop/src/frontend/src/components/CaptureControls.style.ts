import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  camera: { flexShrink: 0, color: colors.fgDefault },
  cameraActive: { color: colors.signal },
  keys: { display: 'inline-flex', gap: 4 },
  dialog: {
    // OS 창 버튼 띠 아래에서 가운데에 놓는다. 창 버튼은 웹 내용보다 먼저 클릭을 받는다.
    marginTop: 'env(titlebar-area-height, 0px)'
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
