import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  list: {
    listStyle: 'none',
    padding: 0,
    marginTop: space.s12,
    marginBottom: 0,
    marginInline: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 12,
    backgroundColor: colors.bgSurface
  },
  item: {
    padding: space.s16,
    overflowWrap: 'anywhere'
  },
  separator: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
  overview: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    rowGap: space.s12,
    columnGap: space.s24
  },
  identity: {
    flex: '1 1 10rem',
    minWidth: 0
  },
  name: {
    color: colors.fgDefault,
    fontSize: 14,
    lineHeight: '19px'
  },
  fame: {
    flex: '0 1 auto',
    maxWidth: '100%',
    marginBlock: 0,
    marginLeft: 'auto',
    marginRight: 0,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums'
  },
  supporting: {
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '16px'
  },
  fameValue: {
    margin: 0,
    fontSize: 14,
    lineHeight: '19px',
    fontWeight: 600
  },
  details: {
    marginTop: space.s8
  },
  summary: {
    width: 'fit-content',
    maxWidth: '100%',
    cursor: 'pointer',
    borderRadius: 4,
    outline: {
      default: null,
      ':focus-visible': `2px solid ${colors.signal}`
    },
    outlineOffset: { default: null, ':focus-visible': 2 }
  },
  identifiers: {
    marginTop: space.s8,
    marginBottom: 0,
    marginInline: 0
  },
  identifier: {
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: 0,
    columnGap: space.s8
  },
  identifierValue: {
    minWidth: 0,
    margin: 0,
    color: colors.fgDefault
  }
})
