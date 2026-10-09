import * as stylex from '@stylexjs/stylex'
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
    borderColor: 'transparent',
    borderRadius: 6,
    // The card stays dark in both modes, so drop SEED's mode-dependent inset stroke.
    boxShadow: 'none',
    backgroundColor: colors.cardControl,
    color: colors.cardFg,
    fontFamily: 'inherit',
    cursor: 'pointer',
    ':hover:not(:disabled)': { backgroundColor: colors.cardControlHover },
    ':is([data-open])': {
      borderColor: colors.borderFocus,
      boxShadow: `0 0 0 1px ${colors.borderFocus}`
    },
    ':focus-visible': { outline: `2px solid ${colors.borderFocus}`, outlineOffset: 2 },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' }
  },
  value: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  positioner: { color: colors.cardFg },
  content: {
    width: 160,
    maxWidth: 'calc(100vw - 16px)',
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.cardBorder,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    boxShadow: 'var(--seed-shadow-s3)',
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0s' }
  },
  scroll: { padding: 6, maxHeight: 'min(320px, var(--seed-select-available-height, 320px))' },
  groupLabel: {
    padding: '6px 10px 8px',
    color: colors.cardFgSubtle
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
    color: colors.cardFg,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    ':is([data-highlighted])': {
      backgroundColor: colors.cardControlHover,
      outline: `1px solid ${colors.borderFocus}`,
      outlineOffset: -1
    }
  },
  selected: {
    backgroundColor: colors.cardBrandWeak,
    ':is([data-highlighted])': { backgroundColor: colors.cardBrandWeak }
  },
  itemLabel: { color: colors.cardFg },
  selectedLabel: { color: colors.cardFgBrand },
  check: { width: 16, height: 16, color: colors.cardFgBrand, flexShrink: 0 }
})
