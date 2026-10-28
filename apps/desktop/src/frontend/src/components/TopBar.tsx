import { PRODUCT_NAME } from '@dfragon/lib'
import { shapes, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode, Ref } from 'react'
import { styles } from './TopBar.style'

export function TopBar({
  nav,
  boardRef,
  notice,
  capture
}: {
  nav: ReactNode
  boardRef: Ref<HTMLDivElement>
  notice?: ReactNode
  capture: ReactNode
}): React.JSX.Element {
  return (
    <header {...stylex.props(styles.header)}>
      <div aria-hidden="true" {...stylex.props(styles.dragArea)} />
      <div {...stylex.props(styles.brand)}>
        <span aria-hidden="true" {...stylex.props(styles.mark, shapes.cutTopRight)} />
        <Typo.h6 as="span" weight={700} {...stylex.props(styles.name)}>
          {PRODUCT_NAME}
        </Typo.h6>
      </div>
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
      {nav}
      <div ref={boardRef} {...stylex.props(styles.board)} />
      <span {...stylex.props(styles.status)}>
        {notice}
        {capture}
      </span>
    </header>
  )
}
