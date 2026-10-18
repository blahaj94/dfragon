import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

// dfragon-design layout.md 상단 바 구성의 내비 항목: 높이 36, 좌우 16, 사이 4. 현재 항목은 오른쪽 위를
// 자른 bg.inset 면에 아래 2px signal 선이고, 하위 메뉴를 펼치면 signal 면이 된다(캔버스 내비 보드).
export const styles = stylex.create({
  nav: { display: 'flex', alignItems: 'center', gap: space.s4, flexShrink: 0 },
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    margin: 0,
    paddingInline: space.s16,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: colors.fgSubtle,
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: 'default',
    outlineOffset: 2,
    ':focus-visible': { outline: `2px solid ${colors.signal}` }
  },
  current: {
    paddingInlineEnd: 14,
    backgroundColor: colors.bgInset,
    color: colors.fgDefault,
    fontWeight: 700,
    boxShadow: `inset 0 -2px 0 ${colors.signal}`,
    cursor: 'pointer',
    transitionProperty: 'background-color, color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  // 자른 모서리가 바깥 포커스 선을 가리므로 현재 항목은 면 안쪽에 선을 그린다.
  currentFocus: {
    ':focus-visible': { outline: `2px solid ${colors.signal}`, outlineOffset: -4 }
  },
  open: { backgroundColor: colors.signal, color: colors.onSignal },
  sub: { fontSize: 12, fontWeight: 600, color: colors.fgMuted },
  chevron: {
    flexShrink: 0,
    color: colors.fgSubtle,
    transitionProperty: 'transform',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  // 펼친 signal 면 위의 하위 이름과 꺾쇠는 onSignal이고, 꺾쇠는 위아래로 뒤집힌다.
  onSignal: { color: colors.onSignal },
  chevronOpen: { transform: 'scaleY(-1)' }
})
