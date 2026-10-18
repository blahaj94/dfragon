import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// dfragon-design layout.md의 보조 창: 상단 바 아래 콘텐츠 여백 24.
export const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault
  },
  content: { flex: 1, minHeight: 0, overflow: 'auto', padding: space.s24 }
})
