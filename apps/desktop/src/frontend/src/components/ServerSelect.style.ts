import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
    maxWidth: '100%',
    minHeight: 24,
    height: 24,
    boxSizing: 'border-box',
    paddingInline: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 4,
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
    width: 16,
    height: 16,
    flexShrink: 0,
    color: colors.cardFgSubtle,
    transition: 'transform 140ms ease',
    ':is([data-open])': { transform: 'rotate(180deg)' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  },
  positioner: { color: colors.cardFg },
  content: {
    width: 120,
    maxWidth: 'calc(100vw - 16px)',
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.cardBorder,
    borderRadius: 8,
    backgroundColor: colors.cardBg,
    boxShadow: 'var(--seed-shadow-s3)',
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0s' }
  },
  scroll: {
    gap: 2,
    padding: 4,
    maxHeight: 'min(320px, var(--seed-select-available-height, 320px))'
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxSizing: 'border-box',
    minHeight: 32,
    padding: '6px 8px',
    borderRadius: 4,
    color: colors.cardFg,
    backgroundColor: 'transparent',
    // SEED paints its own inset pressed layer on highlight; the design hover is the item background.
    '--seed-color-bg-transparent-pressed': 'transparent',
    cursor: 'pointer',
    // The outline stays because pointer hover and keyboard navigation share data-highlighted.
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
