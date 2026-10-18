import type { SVGProps } from 'react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './FoldIcon.style'

// 접기(dfragon-design icons.md의 DFragon 아이콘). 펼친 상태는 두 꺾쇠가 가운데 선으로 모이고, 접힌
// 상태는 꺾쇠가 뒤집혀 바깥으로 벌어진다. 상태는 돌리지 않고 모양으로 바꾼다.
export function FoldIcon({
  collapsed,
  ...props
}: SVGProps<SVGSVGElement> & { collapsed: boolean }): React.JSX.Element {
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
      <path d="m7 4 5 5 5-5" {...stylex.props(styles.chevron, collapsed && styles.topOpen)} />
      <path d="M4 12h16" />
      <path d="m7 20 5-5 5 5" {...stylex.props(styles.chevron, collapsed && styles.bottomOpen)} />
    </svg>
  )
}
