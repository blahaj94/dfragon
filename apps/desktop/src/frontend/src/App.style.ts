import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault
  },
  // OS 창 버튼은 창 위쪽에 고정되므로 상단 바도 고정하고 그 아래 내용만 스크롤한다. 콘텐츠 영역은
  // 네 변 여백 24이고 푸터는 두지 않는다(dfragon-design layout.md).
  content: { flex: 1, minHeight: 0, overflowY: 'auto', padding: space.s24 },
  // 알림, 파티 머리, 카드 사이는 16이다. hidden 속성이 display를 이기도록 숨긴 동안은 그리지 않는다.
  page: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    gap: space.s16
  },
  workbench: { minHeight: '100%' }
})
