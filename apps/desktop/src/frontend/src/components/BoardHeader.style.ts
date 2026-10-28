import * as stylex from '@stylexjs/stylex'
import { colors, font, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexGrow: 1,
    minWidth: 0
  },
  title: { display: 'flex', alignItems: 'baseline', gap: space.s8, minWidth: 0 },
  heading: {
    flexShrink: 0,
    margin: 0,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: '14px',
    color: colors.fgDefault
  },
  number: {
    flexShrink: 0,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 16,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  round: { color: colors.signal },
  total: { color: colors.fgSubtle },
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
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    flexShrink: 0,
    marginInlineStart: 'auto'
  }
})
