import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 44,
    paddingInline: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    boxSizing: 'border-box',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgControl,
    color: colors.fgDefault,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
    ':hover:not(:disabled)': { backgroundColor: colors.bgControlHover },
    ':focus-visible': { outline: `2px solid ${colors.borderFocus}`, outlineOffset: 2 },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  },
  open: { borderColor: colors.borderFocus, boxShadow: `0 0 0 1px ${colors.borderFocus}` },
  value: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  muted: { color: colors.fgMuted },
  icon: { flexShrink: 0, width: 20, height: 20 },
  chevron: {
    flexShrink: 0,
    width: 16,
    height: 16,
    color: colors.fgSubtle,
    transition: 'transform 140ms ease',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  },
  rotated: { transform: 'rotate(180deg)' },
  positioner: { color: colors.fgDefault },
  content: {
    width: 'var(--seed-menu-reference-width)',
    maxWidth: 'calc(100vw - 16px)',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    boxSizing: 'border-box',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    boxShadow: 'var(--seed-shadow-s3)',
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0s' }
  },
  scroll: { padding: 8, gap: 8, maxHeight: 'min(360px, var(--seed-menu-available-height, 360px))' },
  group: { '::before': { display: 'none' } },
  groupLabel: {
    padding: '0 8px 8px',
    color: colors.fgSubtle
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    boxSizing: 'border-box',
    padding: '7px 12px',
    borderRadius: 8,
    color: colors.fgDefault,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    ':hover:not([aria-disabled="true"])': { backgroundColor: colors.bgControlHover },
    ':focus': {
      backgroundColor: colors.bgControlHover,
      outline: `2px solid ${colors.borderFocus}`,
      outlineOffset: -2
    },
    ':active': { backgroundColor: colors.bgControlHover },
    ':is([aria-disabled="true"])': { opacity: 0.4, cursor: 'not-allowed' }
  },
  selected: {
    backgroundColor: colors.bgBrandWeak,
    ':hover:not([aria-disabled="true"])': { backgroundColor: colors.bgBrandWeak },
    ':focus': { backgroundColor: colors.bgBrandWeak },
    ':active': { backgroundColor: colors.bgBrandWeak }
  },
  iconTile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted
  },
  selectedTile: { color: colors.fgBrand },
  itemBody: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  itemLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.fgDefault
  },
  selectedLabel: { color: colors.fgBrand },
  description: { color: colors.fgMuted },
  check: { width: 20, height: 20, flexShrink: 0, color: colors.fgBrand },
  notice: { padding: '4px 8px 12px', color: colors.fgMuted },
  noticeTitle: { paddingBottom: 6, color: colors.fgDefault },
  divider: { height: 1, margin: '2px 8px', backgroundColor: colors.borderDefault, flexShrink: 0 },
  refresh: { minHeight: 36, color: colors.fgMuted }
})
