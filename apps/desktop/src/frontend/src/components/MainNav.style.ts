import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

const popupOpen = ':is([data-popup-open])'

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
    backgroundColor: { default: colors.bgInset, [popupOpen]: colors.signal },
    color: { default: colors.fgDefault, [popupOpen]: colors.onSignal },
    fontWeight: 700,
    boxShadow: `inset 0 -2px 0 ${colors.signal}`,
    cursor: 'pointer',
    transitionProperty: 'background-color, color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  // 자른 모서리가 바깥 포커스 링을 가리므로 현재 항목은 면 안쪽에 선을 그린다.
  currentFocus: {
    ':focus-visible': { outline: `2px solid ${colors.signal}`, outlineOffset: -4 }
  },
  sub: {
    fontSize: 12,
    fontWeight: 600,
    color: { default: colors.fgMuted, [stylex.when.ancestor(popupOpen)]: colors.onSignal }
  },
  chevron: {
    flexShrink: 0,
    color: { default: colors.fgSubtle, [stylex.when.ancestor(popupOpen)]: colors.onSignal },
    transform: { default: 'none', [stylex.when.ancestor(popupOpen)]: 'scaleY(-1)' },
    transitionProperty: 'transform',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  }
})
