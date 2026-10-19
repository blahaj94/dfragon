import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 끄기 확인 팝오버는 펼치는 메뉴와 같은 면(bg.inset, 안쪽 1px border.strong, 위쪽 2px signal 선)이고
// 오른쪽 아래를 자른다(shapes.cutBottomRight). 폭 220, 여백은 위와 좌우 14, 아래 12다.
export const styles = stylex.create({
  positioner: { zIndex: 110, outlineStyle: 'none' },
  popup: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: space.s12,
    width: 220,
    paddingTop: 14,
    paddingInline: 14,
    paddingBottom: space.s12,
    borderTopWidth: 2,
    borderTopStyle: 'solid',
    borderTopColor: colors.signal,
    backgroundColor: colors.bgInset,
    boxShadow: `inset 0 0 0 1px ${colors.borderStrong}`,
    color: colors.fgDefault,
    outlineStyle: 'none'
  },
  title: { margin: 0, fontSize: 14, fontWeight: 700, lineHeight: '20px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: space.s8 }
})
