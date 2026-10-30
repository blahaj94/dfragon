import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { styles } from './BoardHeader.style'
import { NeopleApiLogo } from './NeopleApiLogo'

export function BoardHeader({
  start,
  end
}: {
  start: ReactNode
  end: ReactNode
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.start)}>{start}</div>
      <NeopleApiLogo />
      <div {...stylex.props(styles.end)}>{end}</div>
    </div>
  )
}
