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
  // 위아래 12, 좌우 16 여백이라 파티 카드 한 줄이 163 창에, 공대 카드 세 줄이 300 창에 들어간다
  // (DFragon 디자인 캔버스 축소 시안). 푸터는 두지 않는다.
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBlock: space.s12,
    paddingInline: space.s16
  },
  // 펼친 카드가 남은 높이를 채우도록 콘텐츠 영역 높이까지 늘어난다. 화면 머리는 상단 바에 그린다.
  page: { display: 'flex', flexDirection: 'column', minHeight: '100%', gap: space.s16 }
})
