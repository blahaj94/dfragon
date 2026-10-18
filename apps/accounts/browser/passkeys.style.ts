import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, shape, size, space } from '@dfragon/ui/tokens.stylex'

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
    color: colors.fgMuted,
    wordBreak: 'keep-all'
  },
  keepWords: { wordBreak: 'keep-all' },
  button: { boxSizing: 'border-box', width: '100%', margin: '12px 0' },
  // 버튼 외형은 @dfragon/ui Button(button.style.ts, shapes.cutTopRight)과 같은 규칙을 옮겨 쓴다.
  // 이 화면은 Base UI를 쓰는 기본 entry를 번들하지 않고 링크(<a>)에도 같은 외형이 필요해서다.
  // Button 규칙이 바뀌면 함께 고친다. 높이는 화면 배치를 유지하려고 기존 52, 40px를 쓴다.
  control: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingInline: space.s16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    userSelect: 'none',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2,
    transitionProperty: 'color, background-color, border-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  large: { height: 52 },
  medium: { height: size.controlMd },
  // 주 행동: 신호색 면에 오른쪽 위를 잘라 낸다. 자른 모서리가 바깥 outline을 가려 면 안쪽에 선을 그린다.
  primary: {
    borderWidth: 0,
    borderRadius: radius.panel,
    color: { default: colors.onSignal, ':disabled': colors.fgDisabled },
    backgroundColor: { default: colors.signal, ':disabled': colors.bgControl },
    clipPath: `polygon(0 0, calc(100% - ${shape.cut}) 0, 100% ${shape.cut}, 100% 100%, 0 100%)`,
    outlineColor: colors.onSignal,
    outlineOffset: -4
  },
  secondary: {
    color: { default: colors.fgDefault, ':disabled': colors.fgDisabled },
    borderColor: { default: colors.borderStrong, ':disabled': colors.borderDefault },
    backgroundColor: { default: 'transparent', ':hover:not(:disabled)': colors.bgControlHover }
  },
  key: { padding: '12px 0', borderBottom: `1px solid ${colors.borderDefault}` },
  keys: { padding: 0, listStyle: 'none' },
  status: { minHeight: 28 },
  expiredStatus: { color: colors.fgDanger, whiteSpace: 'pre-line' },
  emptyStatus: { padding: 0, minHeight: 0 },
  brand: { display: 'flex', alignItems: 'center', gap: 8 },
  icon: { flex: 'none', objectFit: 'contain' },
  signupIntro: { padding: '0 0 28px' },
  signupNotice: {
    padding: '16px 20px',
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface
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
    margin: 0
  },
  signupRecovery: { padding: '24px 0' },
  entryDescription: { padding: '0 0 24px' },
  register: { margin: '12px 0 32px' },
  returnButton: { margin: 0 },
  completeHeading: { padding: '0 0 24px' },
  returnHint: { padding: '24px 0 0' }
})
