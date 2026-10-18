import type { SVGProps } from 'react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './SettingsIcon.style'

// 조절 막대(dfragon-design icons.md의 DFragon 아이콘). 가로선 위 사각 손잡이를 상단 바 면 색으로 채워
// 선을 끊는다.
export function SettingsIcon(props: SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      {...props}
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
      <rect x="6" y="4" width="4" height="4" {...stylex.props(styles.handle)} />
      <rect x="14" y="10" width="4" height="4" {...stylex.props(styles.handle)} />
      <rect x="9" y="16" width="4" height="4" {...stylex.props(styles.handle)} />
    </svg>
  )
}
