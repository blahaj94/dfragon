import { PRODUCT_NAME } from '@dfragon/lib'
import { Button, IconButton, shapes, StatusChip, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { useColorTheme } from '../hooks/useColorTheme'
import type { CaptureControlTone } from '../lib/capture-presentation'
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
  captureStatus,
  capture,
  account,
  settings,
  showCapture
}: {
  /** 상단 내비. null이면 로고 옆 구분선과 함께 숨긴다. */
  nav: ReactNode
  captureStatus: { label: string; tone: CaptureControlTone }
  capture: ReactNode
  /**
   * 생략하면 연결 전 자리 표시 버튼을, null이면 계정 UI 없이 표시한다. 넘기는 요소는 상단 바 끌기에서
   * 빠지도록 자기 버튼을 `windowChromeStyles.noDrag`로 감싼다.
   */
  account?: ReactNode
  settings: ReactNode
  showCapture: boolean
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
      {nav != null && (
        <>
          <span aria-hidden="true" {...stylex.props(styles.divider)} />
          {nav}
        </>
      )}
      <div {...stylex.props(styles.end)}>
        {showCapture && (
          <span {...stylex.props(styles.status)}>
            <StatusChip tone={captureStatus.tone} size="md">
              {captureStatus.label}
            </StatusChip>
            <span aria-hidden="true" {...stylex.props(styles.divider)} />
          </span>
        )}
        <div {...stylex.props(styles.tools)}>
          {showCapture && capture}
          <span {...stylex.props(windowChromeStyles.noDrag)}>
            <IconButton
              aria-label={light ? '다크 테마' : '라이트 테마'}
              onClick={toggleTheme}
              icon={light ? <MoonIcon /> : <SunIcon />}
            />
          </span>
          {account === undefined ? (
            <span {...stylex.props(windowChromeStyles.noDrag)}>
              <Button disabled>
                <Typo.txtM as="span" weight={700}>
                  로그인
                </Typo.txtM>
              </Button>
            </span>
          ) : (
            account
          )}
          {settings}
        </div>
      </div>
    </header>
  )
}
