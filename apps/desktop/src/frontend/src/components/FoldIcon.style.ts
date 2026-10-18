import * as stylex from '@stylexjs/stylex'
import { motion } from '@dfragon/ui/tokens.stylex'

// 꺾쇠를 자기 상자 가운데 기준으로 위아래 뒤집는다. 시간은 상태 전환 180ms이고 동작 줄이기에서는 0이다.
export const styles = stylex.create({
  chevron: {
    transformBox: 'fill-box',
    transformOrigin: 'center',
    transitionProperty: 'transform',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  topOpen: { transform: 'translateY(-2px) scaleY(-1)' },
  bottomOpen: { transform: 'translateY(2px) scaleY(-1)' }
})
