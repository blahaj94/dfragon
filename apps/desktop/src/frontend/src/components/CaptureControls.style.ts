import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  camera: { color: colors.fgDefault },
  active: { color: colors.fgBrand },
  activeState: { color: colors.fgInfo },
  dialog: {
    width: 440,
    maxWidth: 'calc(100vw - 32px)',
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    borderRadius: 16
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingRight: 24
  },
  state: { color: colors.fgMuted, whiteSpace: 'nowrap' },
  notice: {
    color: colors.fgMuted,
    paddingTop: 12,
    overflowWrap: 'anywhere'
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 24
  },
  actions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }
})
