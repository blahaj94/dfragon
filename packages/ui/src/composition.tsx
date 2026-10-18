import * as stylex from '@stylexjs/stylex'
import type { PropsWithChildren } from 'react'
import { styles } from './composition.style'

// 예제와 단순 화면의 세로 묶음. 내용 사이 간격은 24px로 같다.
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
