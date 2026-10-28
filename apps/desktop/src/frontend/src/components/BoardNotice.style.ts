import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // title 툴팁이 뜨도록 상단 바의 드래그 영역에서 뺀다.
  notice: {
    position: 'relative',
    WebkitAppRegion: 'no-drag',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.fgMuted,
    fontSize: 12,
    lineHeight: '14px'
  }
})
