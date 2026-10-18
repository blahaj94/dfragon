import * as stylex from '@stylexjs/stylex'
import { colors, radius } from '@dfragon/ui/tokens.stylex'

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
  tabs: { display: 'flex', flexWrap: 'wrap', minHeight: 40 },
  // Design Tab: label width with 12px sides, txtM 700, and a 2px signal underline sitting on the
  // tab bar line.
  tab: {
    minWidth: 0,
    paddingInline: 12,
    borderRadius: 0,
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    color: colors.fgSubtle
  },
  tabSelected: { borderBottomColor: colors.signal, color: colors.fgDefault },
  separator: { width: '100%', height: 1, backgroundColor: colors.borderDefault },
  tabPanel: { marginTop: 24, minWidth: 0 },
  captureInterval: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  // 화면이 정한 trigger 폭. 높이, 면과 열린 상태는 공용 Select의 md 크기가 그린다.
  captureIntervalTrigger: { width: 160 },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    minWidth: 0
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  error: { color: colors.fgDanger },
  evaluation: {
    marginTop: 16,
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault
  },
  evaluationSummary: { cursor: 'pointer', padding: '14px 16px', fontWeight: 700 },
  evaluationBody: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 16px' },
  evaluationSummaryGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px 20px' },
  evaluationResult: { display: 'flex', flexDirection: 'column', gap: 8, overflowWrap: 'anywhere' }
})
