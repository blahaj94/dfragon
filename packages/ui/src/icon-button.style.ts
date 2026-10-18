import * as stylex from '@stylexjs/stylex'
import { colors, radius, size } from './tokens.stylex'

export const styles = stylex.create({
  // 회색 면 없이 아이콘 색만 한 단계 밝혀 hover를 보인다.
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    color: {
      default: colors.fgMuted,
      ':hover:not(:disabled)': colors.fgDefault,
      ':disabled': colors.fgDisabled
    },
    cursor: { default: 'pointer', ':disabled': 'not-allowed' }
  },
  sm: { width: size.controlSm, height: size.controlSm, fontSize: 16 },
  md: { width: size.controlMd, height: size.controlMd, fontSize: 24 },
  // 상단 바 도구 버튼 36은 dfragon-design layout.md가 정한 컨트롤 높이 단계의 예외다.
  bar: { width: 36, height: 36, fontSize: 20 },
  // 화면 머리 도구 버튼(파티 머리의 접기, 스냅샷)은 bg.inset 면의 48px 정사각형이고 오른쪽 위를 자른다.
  // 자른 모서리가 바깥 outline을 가리므로 포커스 선은 면 안쪽에 그린다.
  lg: {
    width: size.controlLg,
    height: size.controlLg,
    fontSize: 24,
    borderRadius: radius.panel,
    backgroundColor: colors.bgInset,
    outlineOffset: -4
  },
  // 화면이 넘긴 SVG를 아이콘 칸에 맞춘다.
  icon: { display: 'inline-flex', width: '1em', height: '1em' }
})
