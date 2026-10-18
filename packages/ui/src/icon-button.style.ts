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
  // 화면이 넘긴 SVG를 아이콘 칸에 맞춘다.
  icon: { display: 'inline-flex', width: '1em', height: '1em' }
})
