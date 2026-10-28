import * as stylex from '@stylexjs/stylex'
import { colors, shape, space } from './tokens.stylex'

const cut = shape.cut
const stripe = shape.hazardStripe

export const shapes = stylex.create({
  cutTopRight: {
    clipPath: `polygon(0 0, calc(100% - ${cut}) 0, 100% ${cut}, 100% 100%, 0 100%)`
  },
  cutBottomRight: {
    clipPath: `polygon(0 0, 100% 0, 100% calc(100% - ${cut}), calc(100% - ${cut}) 100%, 0 100%)`
  },
  gridWell: {
    backgroundColor: colors.bgWell,
    backgroundImage: `linear-gradient(${colors.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${colors.gridLine} 1px, transparent 1px)`,
    backgroundSize: `${shape.gridCell} ${shape.gridCell}`
  },
  alertHatch: {
    backgroundImage: `repeating-linear-gradient(135deg, ${colors.hatchAlert} 0 ${stripe}, transparent ${stripe} calc(${stripe} * 2))`,
    boxShadow: `inset 0 0 0 2px ${colors.bracketDanger}`
  },
  scanlines: {
    backgroundImage: `repeating-linear-gradient(to bottom, ${colors.gridLine} 0 1px, transparent 1px ${space.s4})`
  },
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
