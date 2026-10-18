import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { styles } from './kbd.style'

/** 키캡이 놓이는 면. `signal`은 주 버튼처럼 신호색 면 안에 둔 키캡이다. */
export type KbdSurface = 'default' | 'signal'

export type KbdProps = {
  /** @default 'default' */
  surface?: KbdSurface
  children: ReactNode
}

// 단축키 한 글쇠. 여러 글쇠는 Kbd를 나란히 둔다.
export function Kbd({ surface = 'default', children }: KbdProps) {
  return (
    <kbd
      data-surface={surface}
      {...stylex.props(styles.root, surface === 'signal' && styles.signal)}
    >
      {children}
    </kbd>
  )
}
