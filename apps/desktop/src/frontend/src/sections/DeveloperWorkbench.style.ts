import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  workbench: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    boxSizing: 'border-box',
    minWidth: 0,
    padding: { default: '12px 8px 0', '@media (max-width: 600px)': '12px 0 0' },
    color: colors.shellText
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24
  },
  heading: { display: 'flex', flexDirection: 'column', gap: 4 },
  muted: { color: colors.shellMuted },
  tabs: { display: 'flex', gap: 8, minHeight: 40 },
  tab: {
    minWidth: 0,
    width: { default: 186, '@media (max-width: 600px)': 'calc((100% - 16px) / 3)' },
    height: 40,
    borderRadius: 0,
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    color: colors.shellMuted
  },
  tabSelected: { borderBottomColor: '#f56c00', color: colors.shellText },
  separator: { width: '100%', height: 1, backgroundColor: colors.border, marginTop: 16 },
  tabPanel: { marginTop: 20, minWidth: 0 },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    minWidth: 0
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  error: { color: '#d34d4d' },
  evaluation: {
    marginTop: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.shellText
  },
  evaluationSummary: { cursor: 'pointer', padding: '14px 16px', fontWeight: 700 },
  evaluationBody: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 16px' },
  evaluationSummaryGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px 20px' },
  evaluationResult: { display: 'flex', flexDirection: 'column', gap: 8, overflowWrap: 'anywhere' }
})
