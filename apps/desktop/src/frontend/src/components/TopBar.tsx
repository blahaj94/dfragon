import { PRODUCT_NAME } from '@dfragon/lib'
import { shapes, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { styles } from './TopBar.style'

/**
 * 메인 창 상단 바. 로고, 내비, 화면 머리 자리, 새 버전 알림, 게임 연결 상태 순서로 두고 오른쪽 끝은 OS 창
 * 버튼 자리로 비운다. 화면 머리 자리는 내비와 알림 사이의 남는 폭을 채운다.
 */
export function TopBar({
  nav,
  notice,
  capture
}: {
  nav: ReactNode
  /** 새 버전 알림 칩. 알릴 새 버전이 없으면 비운다. */
  notice?: ReactNode
  /** 게임 연결 상태 칩. 누르면 캡처할 창을 고르는 대화상자를 연다. */
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
      <div {...stylex.props(styles.board)} />
      <span {...stylex.props(styles.status)}>
        {notice}
        {capture}
      </span>
    </header>
  )
}
