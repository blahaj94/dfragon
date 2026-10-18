import * as stylex from '@stylexjs/stylex'
import { colors, motion } from './tokens.stylex'

// 상위, 랭커의 빛줄기. 주기의 6%에서 30% 사이에 카드 왼쪽 밖에서 오른쪽 밖으로 지나가고 나머지 시간은
// 멈춰 있다(dfragon-design motion.md).
const sweep = stylex.keyframes({
  '0%, 6%': { transform: 'translateX(-120%)' },
  '30%, 100%': { transform: 'translateX(260%)' }
})

// 빛줄기는 단계 색을 옅게 섞은 띠다. 캔버스 값은 상위 금색 8%, 랭커 청록 16%다.
const topBand = `color-mix(in srgb, ${colors.tierTop} 8%, transparent)`
const rankerBand = `color-mix(in srgb, ${colors.tierRanker} 16%, transparent)`

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
  },
  // 빛줄기와 스캔선을 담는 층. 꺾쇠가 카드 밖으로 1px 나오므로 카드 대신 이 층이 빛줄기를 자른다.
  effects: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none'
  },
  // 동작 줄이기 설정에서는 빛줄기를 그리지 않는다. 랭커 스캔선은 움직이지 않으므로 남는다.
  sweep: {
    display: { default: 'block', '@media (prefers-reduced-motion: reduce)': 'none' },
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    transform: 'translateX(-120%)',
    animationName: { default: sweep, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.cycle,
    animationTimingFunction: motion.ease,
    animationIterationCount: 'infinite'
  },
  sweepTop: {
    width: '50%',
    backgroundImage: `linear-gradient(100deg, transparent 0, ${topBand} 45%, ${topBand} 55%, transparent 100%)`
  },
  sweepRanker: {
    width: '60%',
    backgroundImage: `linear-gradient(100deg, transparent 0, ${rankerBand} 45%, ${rankerBand} 55%, transparent 100%)`
  }
})
