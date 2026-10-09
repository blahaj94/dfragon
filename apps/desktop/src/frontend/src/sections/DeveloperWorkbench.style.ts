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
    color: colors.fgDefault
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
  muted: { color: colors.fgMuted },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 40 },
  tab: {
    minWidth: 0,
    width: {
      default: 'min(186px, calc((100% - 24px) / 4))',
      '@media (max-width: 600px)': 'calc((100% - 8px) / 2)'
    },
    height: 40,
    borderRadius: 0,
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    color: colors.fgSubtle
  },
  tabSelected: { borderBottomColor: colors.bgBrandSolid, color: colors.fgDefault },
  separator: { width: '100%', height: 1, backgroundColor: colors.borderDefault, marginTop: 16 },
  tabPanel: { marginTop: 20, minWidth: 0 },
  captureInterval: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  captureIntervalInput: {
    minHeight: 32,
    padding: '4px 8px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 6,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    font: 'inherit'
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    minWidth: 0
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  error: { color: colors.fgDanger },
  evaluation: {
    marginTop: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault
  },
  evaluationSummary: { cursor: 'pointer', padding: '14px 16px', fontWeight: 700 },
  evaluationBody: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 16px' },
  evaluationSummaryGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px 20px' },
  evaluationResult: { display: 'flex', flexDirection: 'column', gap: 8, overflowWrap: 'anywhere' }
})
