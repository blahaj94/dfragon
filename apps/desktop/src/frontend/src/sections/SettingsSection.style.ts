import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  dialog: {
    width: 800,
    maxWidth: 'calc(100vw - 24px)',
    // OS 창 버튼 띠 아래에서 가운데에 놓는다. 창 버튼은 웹 내용보다 먼저 클릭을 받는다.
    marginTop: 'env(titlebar-area-height, 0px)',
    maxHeight: 'calc(100dvh - env(titlebar-area-height, 0px) - 24px)',
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 12,
    overflow: 'hidden'
  },
  body: {
    display: 'flex',
    flexDirection: { default: 'row', '@media (max-width: 600px)': 'column' },
    boxSizing: 'border-box',
    minHeight: 0,
    // With the 70px header and the borders this keeps the dialog at 800 x 600.
    height: 'min(528px, calc(100dvh - env(titlebar-area-height, 0px) - 110px))',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flexShrink: 0,
    boxSizing: 'border-box',
    width: { default: 200, '@media (max-width: 600px)': 'auto' },
    padding: { default: '24px 12px', '@media (max-width: 600px)': '8px 12px' }
  },
  group: {
    color: colors.fgSubtle,
    paddingInline: 12,
    paddingBottom: 4,
    display: { default: 'block', '@media (max-width: 600px)': 'none' }
  },
  // NavItem: SEED medium keeps the 40px height and radius; only the inline padding narrows to 12.
  menu: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-start',
    paddingInline: 12,
    borderRadius: 8,
    color: colors.fgSubtle,
    textAlign: 'left'
  },
  menuSelected: { backgroundColor: colors.bgBrandWeak, color: colors.fgDefault },
  appName: {
    marginTop: 'auto',
    paddingInline: 12,
    color: colors.fgMuted,
    display: { default: 'flex', '@media (max-width: 600px)': 'none' },
    alignItems: 'center',
    gap: 8
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflowY: 'auto',
    padding: { default: 24, '@media (max-width: 600px)': 16 },
    backgroundColor: colors.bgSurface,
    // The sidebar and the content share bg.surface, so a line separates them.
    boxShadow: {
      default: `inset 1px 0 0 ${colors.borderDefault}`,
      '@media (max-width: 600px)': `inset 0 1px 0 ${colors.borderDefault}`
    }
  },
  heading: { paddingBottom: 16 },
  developerDescription: { paddingBottom: 20, color: colors.fgMuted },
  // The whole row is the switch label, so the label text and the track share one target.
  developerSwitch: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.bgInset
  },
  developerStatus: { paddingTop: 16, color: colors.fgMuted },
  developerActions: { paddingTop: 16 }
})
