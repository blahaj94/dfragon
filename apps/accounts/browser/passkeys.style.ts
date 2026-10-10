import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  page: {
    maxWidth: 480,
    margin: { default: '8vh auto', '@media (max-width: 560px)': '24px 16px' },
    padding: { default: 32, '@media (max-width: 560px)': 8 }
  },
  authPage: {
    boxSizing: 'border-box',
    maxWidth: 560,
    margin: { default: '8vh auto', '@media (max-width: 560px)': '0 auto' },
    padding: 40
  },
  heading: { padding: '20px 0' },
  authHeading: { padding: '0 0 24px' },
  paragraph: {
    padding: '12px 0',
    color: 'var(--seed-color-fg-neutral-muted)',
    wordBreak: 'keep-all'
  },
  keepWords: { wordBreak: 'keep-all' },
  button: { boxSizing: 'border-box', width: '100%', margin: '12px 0' },
  key: { padding: '12px 0', borderBottom: '1px solid var(--seed-color-stroke-neutral-muted)' },
  keys: { padding: 0, listStyle: 'none' },
  status: { minHeight: 28 },
  emptyStatus: { padding: 0, minHeight: 0 },
  brand: { display: 'flex', alignItems: 'center', gap: 8 },
  icon: { flex: 'none', objectFit: 'contain' },
  signupIntro: { padding: '0 0 28px' },
  signupNotice: {
    padding: '16px 20px',
    borderRadius: 12,
    backgroundColor: 'var(--seed-color-bg-neutral-weak)'
  },
  noticeHeading: { padding: '0 0 4px' },
  noPadding: { padding: 0 },
  actions: {
    display: 'flex',
    gap: 12,
    flexDirection: { default: 'row', '@media (max-width: 460px)': 'column' }
  },
  signupActions: { marginTop: 24 },
  action: {
    flex: { default: 1, '@media (max-width: 460px)': 'auto' },
    minWidth: 0,
    height: 52,
    margin: 0
  },
  signupRecovery: { padding: '24px 0' },
  entryDescription: { padding: '0 0 24px' },
  register: { height: 52, margin: '12px 0 32px' },
  returnButton: { height: 52, margin: 0 },
  completeHeading: { padding: '8px 0 32px' }
})
