import * as stylex from '@stylexjs/stylex'
import { size, space } from '@dfragon/ui/tokens.stylex'

// dfragon-design에 공대 보드가 없어 배치는 작업자가 정했다. 파티 화면처럼 높이 48의 머리 아래 16을 두고,
// 12열 그리드의 3열씩 네 장을 한 파티로 세 줄 놓는다. 카드와 줄 사이는 거터 16이다. 펼친 동안은 머리
// 아래 남은 높이를 세 줄이 나눠 채우고, 접은 동안은 한 줄 카드 높이만 차지한다.
export const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s16,
    minHeight: size.controlLg
  },
  parties: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16
  },
  partiesCollapsed: { flex: '0 0 auto' },
  party: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gridTemplateRows: 'minmax(0, 1fr)',
    flex: '1 1 0',
    minHeight: 0,
    gap: space.s16
  },
  partyCollapsed: { flex: '0 0 auto', gridTemplateRows: 'auto' }
})
