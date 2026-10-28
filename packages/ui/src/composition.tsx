import * as stylex from '@stylexjs/stylex'
import type { PropsWithChildren } from 'react'
import { styles } from './composition.style'

export function ContentStack({ children }: PropsWithChildren) {
  return <div {...stylex.props(styles.stack)}>{children}</div>
}

export function ExampleSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section {...stylex.props(styles.stack)}>
      <h2 {...stylex.props(styles.heading)}>{title}</h2>
      {children}
    </section>
  )
}

export function SupportingText({ children }: PropsWithChildren) {
  return <p {...stylex.props(styles.supporting)}>{children}</p>
}
