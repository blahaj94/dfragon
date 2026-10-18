import * as stylex from '@stylexjs/stylex'
import { colors, size, space } from '@dfragon/ui/tokens.stylex'

// 메인 상단 바와 같은 높이, 면, 여백이다. 높이는 main이 정한 OS 창 버튼 높이를 따르고, 창 버튼이 없는
// 미리보기에서는 시안 높이를 쓴다. 오른쪽 여백은 OS 창 버튼 자리를 비운다.
export const styles = stylex.create({
  bar: {
    position: 'relative',
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: `env(titlebar-area-height, ${size.topbar})`,
    boxSizing: 'border-box',
    paddingLeft: `calc(env(titlebar-area-x, 0px) + ${space.s24})`,
    paddingRight: `max(${space.s24}, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + ${space.s16}))`,
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    color: colors.fgDefault
  },
  // 상단 바 전체를 덮는 빈 요소만 끌기 영역이다. 바에는 누를 요소가 없다.
  dragArea: { position: 'absolute', inset: 0, WebkitAppRegion: 'drag' },
  mark: { width: 24, height: 24, flexShrink: 0, backgroundColor: colors.brandLogo },
  title: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }
})
