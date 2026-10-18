import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

// 목록 면, 항목 hover와 현재 항목 표시는 @dfragon/ui Menu가 그린다. 여기서는 trigger와
// 항목 안 배치, 공용 Menu가 정하지 않는 속성(최소 높이, 세로 여백, 최대 폭)만 둔다.
export const styles = stylex.create({
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    height: 40,
    paddingInline: 12,
    borderRadius: 8,
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
    ':focus-visible': { outline: `2px solid ${colors.signal}`, outlineOffset: 2 },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  },
  open: { borderColor: colors.signal, boxShadow: `0 0 0 1px ${colors.signal}` },
  value: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  muted: { color: colors.fgMuted },
  icon: { flexShrink: 0, width: 24, height: 24 },
  chevron: {
    flexShrink: 0,
    width: 24,
    height: 24,
    color: colors.fgSubtle,
    transition: 'transform 140ms ease',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  },
  rotated: { transform: 'rotate(180deg)' },
  // trigger와 같은 폭으로 펼치고 긴 창 이름은 항목 안에서 말줄임한다.
  popup: { width: 'var(--anchor-width)', maxWidth: 'calc(100vw - 16px)' },
  option: { minHeight: 52, paddingBlock: 7 },
  iconTile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted
  },
  selectedTile: { color: colors.signal },
  itemBody: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  itemLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  description: { color: colors.fgMuted },
  check: { width: 16, height: 16, flexShrink: 0, color: colors.signal },
  notice: { padding: '4px 8px 12px', color: colors.fgMuted },
  noticeTitle: { paddingBottom: 6, color: colors.fgDefault },
  refresh: { minHeight: 36 },
  refreshIcon: { flexShrink: 0, width: 16, height: 16 }
})
