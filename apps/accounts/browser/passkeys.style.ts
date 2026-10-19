import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, shape, size, space } from '@dfragon/ui/tokens.stylex'

const closeBarDrain = stylex.keyframes({
  from: { transform: 'scaleX(1)' },
  to: { transform: 'scaleX(0)' }
})

const cutTopRight = `polygon(0 0, calc(100% - ${shape.cut}) 0, 100% ${shape.cut}, 100% 100%, 0 100%)`

export const styles = stylex.create({
  // 캔버스 "로그인과 회원가입" 보드: 뷰포트 위아래 가운데의 480 패널, 네 모서리 꺾쇠.
  page: {
    boxSizing: 'border-box',
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: { default: space.s24, '@media (max-width: 560px)': space.s16 },
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere'
  },
  panel: {
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    padding: { default: '24px 32px 32px', '@media (max-width: 560px)': '24px 20px' },
    backgroundColor: colors.bgSurface
  },
  centered: { alignItems: 'center', textAlign: 'center' },
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderStyle: 'solid',
    borderWidth: 0,
    borderColor: colors.borderStrong,
    pointerEvents: 'none'
  },
  cornerTopLeft: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTopRight: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBottomLeft: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBottomRight: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  cornerDanger: { borderColor: colors.fgDanger },
  cornerSuccess: { borderColor: colors.fgSuccess },
  mark: {
    height: 24,
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    marginBottom: 32,
    color: colors.fgSubtle,
    fontSize: 13,
    fontWeight: 700
  },
  markSquare: {
    width: 14,
    height: 14,
    backgroundColor: colors.brandLogo,
    clipPath: cutTopRight
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: '36px',
    fontWeight: 700,
    letterSpacing: '-0.01em'
  },
  loginActions: {
    alignSelf: 'stretch',
    display: 'flex',
    flexDirection: 'column',
    gap: space.s8,
    marginTop: 32
  },
  loginButton: { height: size.controlLg, fontSize: 15, fontWeight: 700 },
  heading: { padding: '20px 0' },
  paragraph: {
    padding: '12px 0',
    color: colors.fgMuted,
    wordBreak: 'keep-all'
  },
  keepWords: { wordBreak: 'keep-all' },
  button: { boxSizing: 'border-box', width: '100%', margin: '12px 0' },
  // 버튼 외형은 @dfragon/ui Button(button.style.ts, shapes.cutTopRight)과 같은 규칙을 옮겨 쓴다.
  // 이 화면은 Base UI를 쓰는 기본 entry를 번들하지 않아서다. Button 규칙이 바뀌면 함께 고친다.
  // 관리 화면은 기존 배치를 유지하려고 52, 40px를 쓰고, 로그인은 보드의 48px를 쓴다.
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
    clipPath: cutTopRight,
    outlineColor: colors.onSignal,
    outlineOffset: -4
  },
  secondary: {
    color: { default: colors.fgDefault, ':disabled': colors.fgDisabled },
    borderColor: { default: colors.borderStrong, ':disabled': colors.borderDefault },
    backgroundColor: { default: 'transparent', ':hover:not(:disabled)': colors.bgControlHover }
  },
  // 로그인 보조 행동: 테두리 없이 컨트롤 면으로 채운다.
  filled: {
    borderWidth: 0,
    color: { default: colors.fgDefault, ':disabled': colors.fgDisabled },
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled)': colors.bgControlHover
    }
  },
  key: { padding: '12px 0', borderBottom: `1px solid ${colors.borderDefault}` },
  keys: { padding: 0, listStyle: 'none' },
  status: { minHeight: 28 },
  loginStatus: {
    margin: 0,
    padding: 0,
    fontSize: 13,
    lineHeight: '20px',
    color: colors.fgMuted,
    whiteSpace: 'pre-line'
  },
  loginStatusRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: space.s24
  },
  emptyStatusRow: { marginTop: 0 },
  expiredStatus: { color: colors.fgDanger },
  alertMark: {
    flex: 'none',
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgDangerWeak,
    color: colors.fgDanger,
    fontSize: 15,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    clipPath: cutTopRight
  },
  brand: { display: 'flex', alignItems: 'center', gap: 8 },
  icon: { flex: 'none', objectFit: 'contain' },
  completeContent: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  completeStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    margin: '12px 0 0',
    fontSize: 15,
    lineHeight: '24px',
    fontWeight: 700,
    color: colors.fgSuccess
  },
  completeDot: { width: 6, height: 6, backgroundColor: colors.fgSuccess },
  countdown: {
    margin: '20px 0 0',
    fontSize: 15,
    lineHeight: '24px',
    color: colors.fgMuted
  },
  countdownNumber: {
    fontWeight: 700,
    color: colors.fgDefault,
    fontVariantNumeric: 'tabular-nums'
  },
  closeBar: {
    width: 160,
    height: 2,
    marginTop: 20,
    backgroundColor: colors.bgControlHover,
    overflow: 'hidden'
  },
  closeBarFill: {
    display: 'block',
    height: '100%',
    backgroundColor: colors.signal,
    transformOrigin: 'left',
    animationName: {
      default: closeBarDrain,
      '@media (prefers-reduced-motion: reduce)': 'none'
    },
    // 숫자와 같은 주기다. passkeys.tsx의 CLOSE_COUNTDOWN_SECONDS와 함께 고친다.
    animationDuration: '5s',
    animationTimingFunction: 'linear',
    animationFillMode: 'forwards'
  }
})
