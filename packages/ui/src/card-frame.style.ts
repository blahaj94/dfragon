import * as stylex from '@stylexjs/stylex'
import { colors, motion, shape } from './tokens.stylex'

const stripe = shape.hazardStripe

export const styles = stylex.create({
  // 카드는 반지름 0이고 테두리 없이 면으로 구분한다. 상태는 꺾쇠 색으로 보인다.
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    backgroundColor: colors.cardBg,
    color: colors.cardFg,
    transitionProperty: 'background-color, outline-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  // 실패: 면 위에 135도 사선을 깐다.
  failure: {
    backgroundImage: `repeating-linear-gradient(135deg, ${colors.hazard} 0 ${stripe}, transparent ${stripe} calc(${stripe} * 2))`
  },
  // 대기: 꺾쇠 없이 어두운 면과 점선 외곽선으로 비어 있음을 보인다.
  waiting: {
    backgroundColor: colors.cardBgWaiting,
    outlineWidth: 1,
    outlineStyle: 'dashed',
    outlineColor: colors.cardBorder,
    outlineOffset: -1
  },
  ranker: {
    backgroundColor: colors.tierRankerSurface,
    outlineWidth: 1,
    outlineStyle: 'solid',
    outlineColor: colors.tierRankerOutline,
    outlineOffset: -1
  }
})
