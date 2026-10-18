import * as stylex from '@stylexjs/stylex'
import { space } from '@dfragon/ui/tokens.stylex'

// dfragon-design layout.md: 카드 네 장은 12열 그리드의 3열씩이고 거터 16이다. 최소 창 1024에서도
// 한 줄을 유지하며 카드 폭만 줄어든다. 펼친 카드는 파티 머리 아래 남은 높이를 채우고, 접은 카드는
// 남은 내용 높이만 차지한다.
export const styles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gridTemplateRows: 'minmax(0, 1fr)',
    alignItems: 'stretch',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16
  },
  collapsed: { alignItems: 'start' }
})
