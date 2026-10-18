import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, space } from '@dfragon/ui/tokens.stylex'

// 다음 자동 조회까지 막대가 왼쪽에서 차오른다.
const fill = stylex.keyframes({
  from: { transform: 'scaleX(0)' },
  to: { transform: 'scaleX(1)' }
})

// 목록 면, 항목 hover와 현재 항목 막대는 @dfragon/ui Menu가 그린다. 여기서는 DFragon 디자인 캔버스의
// 창 고르기 목록 값(trigger, 항목 높이와 아이콘 칸, 찾는 중 안내)만 둔다. Menu 항목이 이미 정한 속성과
// 같은 속성을 다시 주면 어느 쪽이 이길지 정해지지 않으므로, 항목 높이는 최소 높이로, 글자 크기와 색은
// 안쪽 글자에, 현재 항목 면은 배경 이미지로 준다.
export const styles = stylex.create({
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 44,
    paddingInline: space.s12,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: 'solid',
    boxSizing: 'border-box',
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 600,
    textAlign: 'left',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    opacity: { default: 1, ':disabled': 0.4 },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  },
  // 펼치면 테두리가 2px 신호색이 되고 안쪽 여백을 1px 줄여 글자 위치를 지킨다.
  open: { borderWidth: 2, borderColor: colors.signal, paddingInline: 11 },
  icon: { flexShrink: 0, width: 18, height: 18, color: colors.fgMuted },
  openIcon: { color: colors.signal },
  value: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  placeholder: { color: colors.fgSubtle, fontWeight: 500 },
  chevron: {
    flexShrink: 0,
    width: 16,
    height: 16,
    color: colors.fgSubtle,
    transitionProperty: 'transform',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  rotated: { transform: 'rotate(180deg)' },
  // trigger와 같은 폭으로 펼치고 긴 창 이름은 항목 안에서 말줄임한다.
  popup: { width: 'var(--anchor-width)', maxWidth: 'calc(100vw - 16px)' },
  groupLabel: { paddingTop: space.s8, paddingBottom: space.s4 },
  groupLabelText: { fontSize: 11, lineHeight: '16px' },
  option: { minHeight: 40, columnGap: 10 },
  // 현재 항목은 한 단계 밝은 면 위에 신호색 이름과 체크를 둔다.
  currentOption: { backgroundImage: `linear-gradient(${colors.bgControl}, ${colors.bgControl})` },
  iconTile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 28,
    height: 28,
    backgroundColor: colors.bgControl,
    color: colors.fgMuted
  },
  selectedTile: { backgroundColor: colors.bgSurface, color: colors.signal },
  itemIcon: { width: 16, height: 16 },
  itemLabel: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    color: colors.fgDefault,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: '18px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  currentLabel: { color: colors.signal },
  disabledLabel: { color: colors.fgDisabled },
  check: { width: 16, height: 16, flexShrink: 0, color: colors.signal },
  notice: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingTop: 10,
    paddingInline: space.s12,
    paddingBottom: space.s8
  },
  failureTitle: { fontSize: 13, lineHeight: '20px', fontWeight: 700, color: colors.fgDefault },
  failureDescription: { fontSize: 12, lineHeight: '18px', color: colors.fgMuted },
  // 창을 찾지 못해 15초마다 다시 조회하는 동안의 안내. 주황 글자 옆 점 세 개가 차례로 켜진다.
  searching: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: '20px',
    color: colors.fgWarning
  },
  retryTrack: {
    display: 'block',
    height: 2,
    marginTop: space.s8,
    overflow: 'hidden',
    backgroundColor: colors.borderDefault
  },
  retryBar: {
    display: 'block',
    height: '100%',
    backgroundColor: colors.fgWarning,
    transformOrigin: 'left',
    animationName: fill,
    animationTimingFunction: 'linear',
    animationFillMode: 'both',
    animationPlayState: { default: 'running', '@media (prefers-reduced-motion: reduce)': 'paused' }
  },
  // 주기는 실제 재조회 간격이고, 지연은 목록을 연 순간까지 이미 지난 시간(음수)이다.
  retryTiming: (duration: string, delay: string) => ({
    animationDuration: duration,
    animationDelay: delay
  }),
  refresh: { minHeight: 36 },
  refreshLabel: { fontSize: 13 },
  refreshIcon: { flexShrink: 0, width: 15, height: 15 }
})
