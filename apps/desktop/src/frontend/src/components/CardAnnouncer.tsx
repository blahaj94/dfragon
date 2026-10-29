import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'

export function CardAnnouncer({ children }: { children: string }): React.JSX.Element {
  return (
    <span aria-live="polite" {...stylex.props(shapes.srOnly)}>
      {children}
    </span>
  )
}
