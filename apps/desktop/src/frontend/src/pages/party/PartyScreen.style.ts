import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 파티 카드. 머리는 상단 바에 그린다. 내용 높이와 무관하게 남은 높이를 나눠 받아 카드가 창 높이에
  // 맞춰 줄어든다. hidden 속성이 display를 이기도록 숨긴 동안은 그리지 않는다.
  party: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16
  }
})
