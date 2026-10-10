import { PRODUCT_NAME } from '@dfragon/lib'
import { ActionButton, IconButton, StatusBadge, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import brandIcon from '../../../../resources/brand.png'
import { useColorTheme } from '../hooks/useColorTheme'
import type { CaptureControlTone } from '../lib/capture-presentation'
import { MoonIcon } from './MoonIcon'
import { SunIcon } from './SunIcon'
import { styles } from './TopBar.style'
import { windowChromeStyles } from '../constants/window-chrome.style'

export function TopBar({
  captureStatus,
  capture,
  account,
  settings,
  showCapture
}: {
  captureStatus: { label: string; tone: CaptureControlTone }
  capture: ReactNode
  /** 생략하면 연결 전 자리 표시 버튼을, null이면 계정 UI 없이 표시한다. */
  account?: ReactNode
  settings: ReactNode
  showCapture: boolean
}): React.JSX.Element {
  const { light, toggleTheme } = useColorTheme()

  return (
    <header {...stylex.props(styles.header)}>
      <div aria-hidden="true" {...stylex.props(styles.dragArea)} />
      <div {...stylex.props(styles.brand)}>
        <img src={brandIcon} width={24} height={24} alt="" />
        <Typo.h6 as="span" {...stylex.props(styles.name)}>
          {PRODUCT_NAME}
        </Typo.h6>
      </div>
      {showCapture && (
        <div {...stylex.props(styles.status)}>
          <StatusBadge tone={captureStatus.tone}>{captureStatus.label}</StatusBadge>
        </div>
      )}
      <div {...stylex.props(styles.actions)}>
        {showCapture && capture}
        <span {...stylex.props(windowChromeStyles.noDrag)}>
          <IconButton
            variant="ghost"
            aria-label={light ? '다크 테마' : '라이트 테마'}
            onClick={toggleTheme}
            icon={light ? <MoonIcon /> : <SunIcon />}
          />
        </span>
        {account === undefined ? (
          <span {...stylex.props(windowChromeStyles.noDrag)}>
            <ActionButton size="medium" variant="neutralWeak" disabled>
              <Typo.txtM as="span" weight={700}>
                로그인
              </Typo.txtM>
            </ActionButton>
          </span>
        ) : (
          account != null && <span {...stylex.props(windowChromeStyles.noDrag)}>{account}</span>
        )}
        {settings}
      </div>
    </header>
  )
}
