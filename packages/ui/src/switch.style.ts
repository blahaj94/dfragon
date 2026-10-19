import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from './tokens.stylex'

// 정사각 스위치는 DFragon 디자인 캔버스의 설정 보드(44x22, 손잡이 14, 바깥에서 4)를 따른다.
export const styles = stylex.create({
  root: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    width: 44,
    height: 22,
    padding: 3,
    margin: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: radius.control,
    cursor: { default: 'pointer', ':is([data-disabled])': 'not-allowed' },
    borderColor: {
      default: colors.borderStrong,
      ':is([data-checked])': colors.signal,
      ':is([data-disabled])': colors.borderDefault
    },
    backgroundColor: {
      default: colors.bgControl,
      ':is([data-checked])': colors.signal,
      ':is([data-disabled])': colors.bgControl
    },
    transitionProperty: 'background-color, border-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  // 각진 손잡이. 켜면 오른쪽으로 옮겨 가며 신호색 위에서는 글자색이 된다.
  thumb: {
    width: 14,
    height: 14,
    backgroundColor: {
      default: colors.fgSubtle,
      ':is([data-checked])': colors.onSignal,
      ':is([data-disabled])': colors.fgDisabled
    },
    transform: { default: 'translateX(0)', ':is([data-checked])': 'translateX(22px)' },
    transitionProperty: 'transform, background-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  }
})
