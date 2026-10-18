import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, space } from '@dfragon/ui/tokens.stylex'

// 인식하는 동안 대화상자 꺾쇠가 박자 두 번에 한 번 바깥 4px에서 제자리로 조여 든다. 카드의 이름 수정
// 중 꺾쇠(@dfragon/ui CornerBrackets selected)와 같은 움직임이다.
const pulseTopLeft = stylex.keyframes({
  '0%': { transform: 'translate(-4px, -4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseTopRight = stylex.keyframes({
  '0%': { transform: 'translate(4px, -4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseBottomLeft = stylex.keyframes({
  '0%': { transform: 'translate(-4px, 4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseBottomRight = stylex.keyframes({
  '0%': { transform: 'translate(4px, 4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})

// 값은 DFragon 디자인 캔버스의 캡처 보드(메인 위 캡처 창, 다섯 상태, 창 고르기 목록)를 따른다.
export const styles = stylex.create({
  // 상태 칩을 감싼 대화상자 버튼. 칩의 모양을 그대로 보이고, 칩이 오른쪽 위를 잘라 바깥 outline이
  // 가려지지 않도록 포커스 선은 버튼 바깥에 둔다.
  trigger: {
    display: 'inline-flex',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  },
  // 머리, 본문, 바닥이 각자 여백을 가진다. 꺾쇠가 테두리 1px 바깥까지 걸치므로 잘리지 않게 넘침을 보인다.
  // 같은 우선순위의 속성끼리는 어느 쪽이 이길지 정해지지 않으므로, 공용 대화상자의 padding, gap, overflow
  // 단축 속성보다 우선하는 개별 속성으로 덮는다.
  dialog: {
    // OS 창 버튼 띠 아래에서 가운데에 놓는다. 창 버튼은 웹 내용보다 먼저 클릭을 받는다.
    marginTop: 'env(titlebar-area-height, 0px)',
    rowGap: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    overflowX: 'visible',
    overflowY: 'visible',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)'
  },
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderStyle: 'solid',
    borderWidth: 0,
    pointerEvents: 'none',
    transitionProperty: 'border-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  topLeft: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  bottomLeft: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  bottomRight: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  // 대화상자는 테마를 따르는 면이라 카드 전용 bracket 토큰 대신 같은 역할의 의미 토큰을 쓴다.
  neutral: { borderColor: colors.borderStrong },
  success: { borderColor: colors.fgSuccess },
  danger: { borderColor: colors.fgDanger },
  warning: { borderColor: colors.fgWarning },
  signal: { borderColor: colors.signal },
  pulse: {
    animationDuration: `calc(${motion.beat} * 2)`,
    animationIterationCount: 'infinite',
    animationTimingFunction: motion.ease
  },
  pulseTopLeft: {
    animationName: { default: pulseTopLeft, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseTopRight: {
    animationName: { default: pulseTopRight, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseBottomLeft: {
    animationName: { default: pulseBottomLeft, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseBottomRight: {
    animationName: {
      default: pulseBottomRight,
      '@media (prefers-reduced-motion: reduce)': 'none'
    }
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s12,
    height: 64,
    paddingInlineStart: space.s24,
    paddingInlineEnd: space.s16
  },
  title: { flexGrow: 1, margin: 0 },
  // 닫기 아이콘은 18px이다. IconButton sm의 16px 아이콘 칸 가운데에 두려고 바깥으로 1px씩 넘긴다.
  closeIcon: { width: 18, height: 18, margin: -1 },
  body: { paddingTop: space.s4, paddingInline: space.s24 },
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    margin: 0,
    marginTop: space.s12,
    fontSize: 13,
    lineHeight: '20px',
    color: colors.fgMuted,
    overflowWrap: 'anywhere'
  },
  // 확인 필요, 캡처 실패 안내 앞의 `!` 칸. 카드의 검색 실패 칸과 같은 모양이다(shapes.cutTopRight와 함께).
  mark: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 18,
    height: 18,
    fontFamily: font.num,
    fontSize: 14,
    fontWeight: 700
  },
  warningMark: {
    backgroundColor: `color-mix(in srgb, ${colors.fgWarning} 16%, transparent)`,
    color: colors.fgWarning
  },
  // 캡처 실패는 카드의 검색 실패 `!` 칸과 같은 위험 색이다.
  failureMark: { backgroundColor: colors.bgDangerWeak, color: colors.fgDanger },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: space.s8,
    paddingTop: 20,
    paddingInline: space.s24,
    paddingBottom: space.s24
  },
  secondaryAction: {
    paddingLeft: 18,
    paddingRight: 18,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    // 공용 보조 버튼의 투명 면과 같은 속성을 피해 배경 이미지로 채운다.
    backgroundImage: {
      default: `linear-gradient(${colors.bgControl}, ${colors.bgControl})`,
      ':hover:not(:disabled)': `linear-gradient(${colors.bgControlHover}, ${colors.bgControlHover})`
    }
  },
  primaryAction: { paddingLeft: 18, paddingRight: 20 }
})
