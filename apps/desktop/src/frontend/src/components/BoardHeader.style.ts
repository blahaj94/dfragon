import * as stylex from '@stylexjs/stylex'
import { colors, font, size, space } from '@dfragon/ui/tokens.stylex'

// dfragon-design layout.md의 파티 머리는 높이 48이고 카드와 16 떨어진다. 배치와 글자 크기는 DFragon
// 디자인 캔버스 메인 보드의 파티 머리를 따르며 공대 보드의 머리도 같다. 간격은 머리를 놓는 화면이 정한다.
export const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.s16,
    minHeight: size.controlLg,
    // 공대 보드는 머리를 고정하고 보드만 스크롤한다.
    flexShrink: 0
  },
  title: { display: 'flex', alignItems: 'baseline', gap: space.s12, minWidth: 0 },
  heading: { flexShrink: 0, letterSpacing: '-0.01em' },
  count: {
    flexShrink: 0,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 28,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  // 스냅샷 회차 번호(`#2`). 인원수와 같은 28px이고 `#`도 줄이지 않는다. 색은 신호색이라 다크는 크림이다.
  round: {
    flexShrink: 0,
    color: colors.signal,
    fontFamily: font.num,
    fontSize: 28,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  total: { color: colors.fgSubtle },
  notice: {
    minWidth: 0,
    color: colors.fgMuted,
    fontSize: 13,
    lineHeight: '18px',
    overflowWrap: 'anywhere'
  },
  actions: { display: 'flex', alignItems: 'center', gap: space.s16, flexShrink: 0 }
})
