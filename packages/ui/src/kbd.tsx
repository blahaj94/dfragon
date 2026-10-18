import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { styles } from './kbd.style'

export type KbdProps = {
  children: ReactNode
}

// 단축키 한 글쇠. 여러 글쇠는 Kbd를 나란히 둔다.
export function Kbd({ children }: KbdProps) {
  return <kbd {...stylex.props(styles.root)}>{children}</kbd>
}
