import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  list: {
    listStyle: 'none',
    padding: 0,
    marginTop: 'var(--seed-dimension-x3)',
    marginBottom: 0,
    marginInline: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--seed-color-stroke-neutral-muted)',
    borderRadius: 'var(--seed-radius-r3)',
    backgroundColor: 'var(--seed-color-bg-layer-default)'
  },
  item: {
    padding: 'var(--seed-dimension-x4)',
    overflowWrap: 'anywhere'
  },
  separator: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--seed-color-stroke-neutral-muted)'
  },
  overview: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    rowGap: 'var(--seed-dimension-x3)',
    columnGap: 'var(--seed-dimension-x6)'
  },
  identity: {
    flex: '1 1 10rem',
    minWidth: 0
  },
  name: {
    color: 'var(--seed-color-fg-neutral)',
    fontSize: 'var(--seed-font-size-t4)',
    lineHeight: 'var(--seed-line-height-t4)'
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
    color: 'var(--seed-color-fg-neutral-subtle)',
    fontSize: 'var(--seed-font-size-t2)',
    lineHeight: 'var(--seed-line-height-t2)'
  },
  fameValue: {
    margin: 0,
    fontSize: 'var(--seed-font-size-t4)',
    lineHeight: 'var(--seed-line-height-t4)',
    fontWeight: 600
  },
  details: {
    marginTop: 'var(--seed-dimension-x2)'
  },
  summary: {
    width: 'fit-content',
    maxWidth: '100%',
    cursor: 'pointer',
    borderRadius: 'var(--seed-radius-r1)',
    outline: {
      default: null,
      ':focus-visible': '2px solid var(--seed-color-stroke-focus-ring)'
    },
    outlineOffset: { default: null, ':focus-visible': 2 }
  },
  identifiers: {
    marginTop: 'var(--seed-dimension-x2)',
    marginBottom: 0,
    marginInline: 0
  },
  identifier: {
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: 0,
    columnGap: 'var(--seed-dimension-x2)'
  },
  identifierValue: {
    minWidth: 0,
    margin: 0,
    color: 'var(--seed-color-fg-neutral)'
  }
})
