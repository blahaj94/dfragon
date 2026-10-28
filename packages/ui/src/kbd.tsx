import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { styles } from './kbd.style'

export type KbdSurface = 'default' | 'signal'

export type KbdProps = {
  surface?: KbdSurface
  children: ReactNode
}

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
