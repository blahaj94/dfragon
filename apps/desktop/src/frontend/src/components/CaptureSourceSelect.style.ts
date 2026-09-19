import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'
import { selectColors as palette } from '../constants/select.stylex'

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
    borderColor: palette.border,
    backgroundColor: palette.input,
    color: colors.shellText,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
    ':hover:not(:disabled)': { backgroundColor: palette.hover },
    ':focus-visible': { outline: '2px solid #ff9f0a', outlineOffset: 2 },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  },
  open: { borderColor: '#ff9f0a', boxShadow: '0 0 0 3px rgba(255, 159, 10, 0.2)' },
  value: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  muted: { color: colors.shellMuted },
  icon: { flexShrink: 0, width: 20, height: 20 },
  chevron: {
    flexShrink: 0,
    width: 16,
    height: 16,
    color: colors.shellMuted,
    transition: 'transform 140ms ease',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  },
  rotated: { transform: 'rotate(180deg)' },
  positioner: { fontFamily: 'NanumSquareNeo, sans-serif', color: colors.shellText },
  content: {
    width: 'var(--seed-menu-reference-width)',
    maxWidth: 'calc(100vw - 16px)',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    boxSizing: 'border-box',
    borderColor: palette.border,
    backgroundColor: colors.surface,
    boxShadow: `0 12px 32px -8px ${palette.shadow}`,
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0s' }
  },
  scroll: { padding: 8, gap: 8, maxHeight: 'min(360px, var(--seed-menu-available-height, 360px))' },
  group: { '::before': { display: 'none' } },
  groupLabel: {
    padding: '0 8px 8px',
    color: colors.shellMuted
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    boxSizing: 'border-box',
    padding: '7px 12px',
    borderRadius: 8,
    color: colors.shellText,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    ':hover:not([aria-disabled="true"])': { backgroundColor: palette.hover },
    ':focus': { backgroundColor: palette.hover, outline: '2px solid #ff9f0a', outlineOffset: -2 },
    ':active': { backgroundColor: palette.hover },
    ':is([aria-disabled="true"])': { opacity: 0.4, cursor: 'not-allowed' }
  },
  selected: {
    backgroundColor: palette.selected,
    ':hover:not([aria-disabled="true"])': { backgroundColor: palette.selected },
    ':focus': { backgroundColor: palette.selected },
    ':active': { backgroundColor: palette.selected }
  },
  iconTile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: palette.hover,
    color: colors.shellMuted
  },
  selectedTile: { backgroundColor: palette.selectedIcon, color: palette.accent },
  itemBody: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  itemLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.shellText
  },
  description: { color: colors.shellMuted },
  check: { width: 20, height: 20, flexShrink: 0, color: palette.accent },
  notice: { padding: '4px 8px 12px', color: colors.shellMuted },
  noticeTitle: { paddingBottom: 6, color: colors.shellText },
  divider: { height: 1, margin: '2px 8px', backgroundColor: palette.divider, flexShrink: 0 },
  refresh: { minHeight: 36, color: colors.shellMuted }
})
