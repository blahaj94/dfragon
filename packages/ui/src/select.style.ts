import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, size, space } from './tokens.stylex'

export const styles = stylex.create({
  // 칩 모양 trigger. 펼쳐진 동안 신호색 면으로 바뀐다.
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.s4,
    minWidth: 0,
    margin: 0,
    paddingInlineStart: space.s8,
    paddingInlineEnd: 6,
    borderWidth: 0,
    borderRadius: radius.control,
    fontFamily: 'inherit',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    color: {
      default: colors.fgDefault,
      ':is([data-popup-open])': colors.onSignal,
      ':disabled': colors.fgDisabled
    },
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled, [data-popup-open])': colors.bgControlHover,
      ':is([data-popup-open])': colors.signal
    }
  },
  xs: { height: 24, fontSize: 12 },
  sm: { height: size.controlSm, fontSize: 13 },
  md: { height: size.controlMd, fontSize: 14 },
  value: { overflow: 'hidden', textOverflow: 'ellipsis' },
  placeholder: { color: colors.fgPlaceholder },
  // 펼치면 아래 꺾쇠가 위 꺾쇠로 바뀐다.
  icon: {
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: 14,
    transform: { default: 'none', ':is([data-popup-open])': 'scaleY(-1)' },
    transitionProperty: 'transform',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  item: { height: 28, fontSize: 13 },
  // 캐릭터 카드 위의 칩. 라이트 모드에서도 카드가 다크이므로 card* 토큰으로 그린다.
  cardTrigger: {
    color: {
      default: colors.cardFg,
      ':is([data-popup-open])': colors.cardOnSignal,
      ':disabled': colors.cardFgSubtle
    },
    backgroundColor: {
      default: colors.cardControl,
      ':hover:not(:disabled, [data-popup-open])': colors.cardControlHover,
      ':is([data-popup-open])': colors.cardSignal
    },
    outlineColor: colors.cardSignal
  }
})
