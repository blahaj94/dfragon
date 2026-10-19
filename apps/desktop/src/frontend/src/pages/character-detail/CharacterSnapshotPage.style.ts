import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 상세 패널을 읽기 전과 읽지 못한 화면. 패널과 같은 다크 카드 면에 안내를 가운데 두고, OS 제목줄이 없어 창 위
// 40을 끌기 영역으로 남긴다.
export const styles = stylex.create({
  page: {
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr)',
    height: '100vh',
    backgroundColor: colors.cardBg
  },
  dragArea: { height: 40, flexShrink: 0, WebkitAppRegion: 'drag' },
  body: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s16,
    paddingInline: space.s24,
    textAlign: 'center',
    color: colors.cardFgMuted
  },
  close: { WebkitAppRegion: 'no-drag' }
})
