import { PRODUCT_NAME } from '@dfragon/lib'
import { IconButton, shapes, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { useColorTheme } from '../hooks/useColorTheme'
import { MoonIcon } from './MoonIcon'
import { SunIcon } from './SunIcon'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { styles } from './TopBar.style'

/**
 * 메인 창 상단 바. dfragon-design layout.md의 상단 바 구성 순서대로 로고, 내비, 게임 연결 상태,
 * 도구 버튼을 두고 오른쪽 끝은 OS 창 버튼 자리로 비운다.
 */
export function TopBar({
  nav,
  capture
}: {
  nav: ReactNode
  /** 게임 연결 상태 칩. 누르면 캡처할 창을 고르는 대화상자를 연다. */
  capture: ReactNode
}): React.JSX.Element {
  const { light, toggleTheme } = useColorTheme()

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
      <div {...stylex.props(styles.end)}>
        <span {...stylex.props(styles.status)}>
          {capture}
          <span aria-hidden="true" {...stylex.props(styles.divider)} />
        </span>
        <div {...stylex.props(styles.tools)}>
          <span {...stylex.props(windowChromeStyles.noDrag)}>
            <IconButton
              size="bar"
              aria-label={light ? '다크 테마' : '라이트 테마'}
              onClick={toggleTheme}
              icon={light ? <MoonIcon /> : <SunIcon />}
            />
          </span>
        </div>
      </div>
    </header>
  )
}
