import * as stylex from '@stylexjs/stylex'
import { selectColors } from '../constants/select.stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
    maxWidth: '100%',
    minHeight: 24,
    height: 24,
    boxSizing: 'border-box',
    paddingInline: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#b96931',
    borderRadius: 6,
    backgroundColor: '#4a3025',
    color: '#ffad78',
    fontFamily: 'inherit',
    fontSize: 11,
    cursor: 'pointer',
    ':hover:not(:disabled)': { backgroundColor: '#60402d' },
    ':is([data-open])': { borderColor: '#ff9f0a', boxShadow: '0 0 0 2px rgba(255,159,10,0.2)' },
    ':focus-visible': { outline: '2px solid #ff9f0a', outlineOffset: 2 },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' }
  },
  value: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 11,
    lineHeight: '16px',
    color: 'inherit'
  },
  chevron: {
    width: 12,
    height: 12,
    flexShrink: 0,
    color: 'inherit',
    transition: 'transform 140ms ease',
    ':is([data-open])': { transform: 'rotate(180deg)' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  },
  positioner: { fontFamily: 'NanumSquareNeo, sans-serif', color: colors.text },
  content: {
    width: 160,
    maxWidth: 'calc(100vw - 16px)',
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: selectColors.border,
    borderRadius: 12,
    backgroundColor: '#292d33',
    boxShadow: `0 12px 32px -8px ${selectColors.shadow}`,
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0s' }
  },
  scroll: { padding: 6, maxHeight: 'min(320px, var(--seed-select-available-height, 320px))' },
  groupLabel: {
    padding: '6px 10px 8px',
    color: colors.muted,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 400
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    boxSizing: 'border-box',
    minHeight: 32,
    padding: '6px 10px',
    borderRadius: 6,
    color: colors.text,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    ':is([data-highlighted])': {
      backgroundColor: selectColors.hover,
      outline: '1px solid #ff9f0a',
      outlineOffset: -1
    }
  },
  selected: {
    backgroundColor: selectColors.selected,
    ':is([data-highlighted])': { backgroundColor: selectColors.selected }
  },
  itemLabel: { fontSize: 12, lineHeight: '20px', fontWeight: 400, color: colors.text },
  check: { width: 16, height: 16, color: selectColors.accent, flexShrink: 0 }
})
