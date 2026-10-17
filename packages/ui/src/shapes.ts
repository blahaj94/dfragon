import * as stylex from '@stylexjs/stylex'
import { colors, shape, space } from './tokens.stylex'

const cut = shape.cut
const stripe = shape.hazardStripe

// 여러 화면이 같이 쓰는 형태. 화면은 stylex.props(shapes.gridWell, failed && shapes.hazardStripes)처럼 합성한다.
export const shapes = stylex.create({
  // 누를 수 있는 주 행동과 현재 위치. 오른쪽 위를 잘라 낸다.
  cutTopRight: {
    clipPath: `polygon(0 0, calc(100% - ${cut}) 0, 100% ${cut}, 100% 100%, 0 100%)`
  },
  // 아래로 펼쳐지는 메뉴와 listbox. 오른쪽 아래를 잘라 낸다.
  cutBottomRight: {
    clipPath: `polygon(0 0, 100% 0, 100% calc(100% - ${cut}), calc(100% - ${cut}) 100%, 0 100%)`
  },
  // 그림 칸. well 바탕에 격자 선을 깐다.
  gridWell: {
    backgroundColor: colors.bgWell,
    backgroundImage: `linear-gradient(${colors.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${colors.gridLine} 1px, transparent 1px)`,
    backgroundSize: `${shape.gridCell} ${shape.gridCell}`
  },
  // 검색 실패 그림 칸. 격자 대신 135도 사선을 깔고, gridWell 뒤에 합성해도 격자 크기가 남지 않게 한다.
  hazardStripes: {
    backgroundColor: colors.bgWell,
    backgroundImage: `repeating-linear-gradient(135deg, ${colors.hazard} 0 ${stripe}, transparent ${stripe} calc(${stripe} * 2))`,
    backgroundSize: 'auto'
  },
  // 랭커 카드의 옅은 가로 스캔선.
  scanlines: {
    backgroundImage: `repeating-linear-gradient(to bottom, ${colors.gridLine} 0 1px, transparent 1px ${space.s4})`
  },
  // 화면에는 보이지 않고 보조 기술에만 읽히는 글자.
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0
  }
})
