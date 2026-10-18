import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 상태 칩을 감싼 대화상자 버튼. 칩의 모양을 그대로 보이고, 칩이 오른쪽 위를 잘라 바깥 outline이
  // 가려지지 않도록 포커스 선은 버튼 바깥에 둔다.
  trigger: {
    display: 'inline-flex',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  },
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
