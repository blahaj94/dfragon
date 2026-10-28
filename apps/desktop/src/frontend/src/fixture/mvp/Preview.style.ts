import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  app: {
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    boxShadow: `0 1px 0 ${colors.borderDefault}`
  },
  windowHeight: (height: number) => ({ height }),
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBlock: space.s12,
    paddingInline: space.s16
  },
  page: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    minHeight: '100%',
    gap: space.s16
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    margin: '16px 16px 0',
    fontSize: 12,
    color: colors.fgMuted
  },
  select: {
    maxWidth: '100%',
    padding: 6,
    fontFamily: 'inherit',
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 6
  },
  notice: { fontSize: 12, lineHeight: 1.6, color: colors.fgMuted, margin: '12px 16px 0' }
})
