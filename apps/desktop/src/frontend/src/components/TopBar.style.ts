import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

// 숨김 기준은 OS 창 버튼 자리를 뺀 상단 바 내용 폭이다. 로그인 버튼이 있을 때 도구 묶음 224px,
// 로고 103px, 가장 긴 배지 80px과 간격을 더한 값에서 배지를, 배지 없이 모자라면 제품 이름을 숨긴다.
const HIDE_STATUS = '@container (max-width: 440px)'
const HIDE_NAME = '@container (max-width: 344px)'

export const styles = stylex.create({
  header: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    // main이 정한 OS 창 버튼 높이를 따르고, 창 버튼이 없는 미리보기에서는 시안 높이를 쓴다.
    height: 'env(titlebar-area-height, 56px)',
    boxSizing: 'border-box',
    paddingLeft: 'calc(env(titlebar-area-x, 0px) + 24px)',
    paddingRight:
      'max(24px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 16px))',
    containerType: 'inline-size',
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    WebkitAppRegion: 'drag'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    marginInlineEnd: 'auto'
  },
  name: { display: { default: 'inline', [HIDE_NAME]: 'none' }, whiteSpace: 'nowrap' },
  status: { display: { default: 'flex', [HIDE_STATUS]: 'none' }, flexShrink: 0 },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    WebkitAppRegion: 'no-drag'
  }
})
