import { PRODUCT_NAME } from '@dfragon/lib'
import { useId, useState, type ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import {
  Button,
  DialogContent,
  DialogRoot,
  DialogTrigger,
  IconButton,
  shapes,
  Switch
} from '@dfragon/ui'
import type { NoticeEntry } from '@dfragon/licenses/types'
import { CloseIcon } from '../components/CloseIcon'
import { OpenSourceNotices } from '../components/OpenSourceNotices'
import { SettingsIcon } from '../components/SettingsIcon'
import type { DeveloperModeState } from '../hooks/useDeveloperMode'
import { styles } from './SettingsSection.style'

const corners = [styles.topLeft, styles.topRight, styles.bottomLeft, styles.bottomRight]

const menus = [
  { id: 'licenses', label: '라이선스 사용고지' },
  { id: 'developer', label: '개발자 모드' }
] as const satisfies readonly { id: string; label: string }[]

type SettingsMenu = (typeof menus)[number]['id']

/**
 * 상단 바의 설정 버튼과 설정 대화상자. DFragon 디자인 캔버스의 설정과 라이선스 보드대로 왼쪽 메뉴, 메뉴 아래쪽의
 * 계정 버튼과 앱 이름, 오른쪽 본문을 둔다.
 */
export function SettingsSection({
  account,
  developerMode,
  onOpenDeveloperWorkbench
}: {
  /** 메뉴 아래쪽에 두는 로그인 버튼. 로그인 설정이 없는 빌드는 생략한다. */
  account?: ReactNode
  developerMode?: DeveloperModeState
  onOpenDeveloperWorkbench?: () => void
}): React.JSX.Element {
  const titleId = useId()
  const developerLabelId = useId()
  const [open, setOpen] = useState(false)
  const [selectedMenu, setSelectedMenu] = useState<SettingsMenu>('licenses')
  const [entries, setEntries] = useState<NoticeEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const mode = developerMode ?? {
    status: 'unavailable' as const,
    enabled: false,
    updating: false,
    retry: () => {},
    setEnabled: () => {}
  }

  async function loadNotices(): Promise<void> {
    setFailed(false)
    try {
      const catalog = await import('virtual:dfragon-desktop-licenses')
      setEntries(catalog.default)
    } catch {
      setFailed(true)
    }
  }

  function renderError(message: string, onRetry: () => void): React.JSX.Element {
    return (
      <div role="alert" {...stylex.props(styles.error)}>
        <p {...stylex.props(styles.errorText)}>
          <span aria-hidden="true" {...stylex.props(styles.errorMark, shapes.cutTopRight)}>
            !
          </span>
          {message}
        </p>
        <Button size="sm" onClick={() => onRetry()}>
          다시 시도
        </Button>
      </div>
    )
  }

  function renderLicenses(): React.JSX.Element | null {
    if (entries) {
      return <OpenSourceNotices entries={entries} />
    }

    if (failed) {
      return renderError('라이선스 정보를 불러오지 못했습니다.', () => void loadNotices())
    }

    // 불러오는 동안은 안내 문구 없이 비워 둔다. 데이터는 앱에 포함되어 곧바로 읽힌다.

    return null
  }

  function renderDeveloperMode(): React.JSX.Element | null {
    if (mode.status === 'loading') {
      return null
    }

    if (mode.status === 'unavailable') {
      return (
        <p role="status" {...stylex.props(styles.errorText)}>
          <span aria-hidden="true" {...stylex.props(styles.errorMark, shapes.cutTopRight)}>
            !
          </span>
          이 실행 환경에서는 개발자 모드를 사용할 수 없습니다.
        </p>
      )
    }

    if (mode.status === 'error') {
      return renderError('개발자 모드 설정을 불러오거나 저장하지 못했습니다.', mode.retry)
    }

    return (
      <>
        {/* 줄 전체가 스위치 라벨이라 글자와 스위치를 함께 눌러 바꾼다. */}
        <label {...stylex.props(styles.switchRow)}>
          <span id={developerLabelId}>개발자 모드</span>
          <Switch
            aria-labelledby={developerLabelId}
            checked={mode.enabled}
            disabled={mode.updating}
            aria-busy={mode.updating}
            onCheckedChange={(checked) => mode.setEnabled(checked)}
          />
        </label>
        {mode.enabled && onOpenDeveloperWorkbench && (
          <div {...stylex.props(styles.developerActions)}>
            <Button
              variant="primary"
              {...stylex.props(styles.developerOpen)}
              onClick={() => {
                setOpen(false)
                onOpenDeveloperWorkbench()
              }}
            >
              개발 도구 열기
            </Button>
          </div>
        )}
      </>
    )
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen && entries == null) {
          void loadNotices()
        }
      }}
    >
      <span {...stylex.props(windowChromeStyles.noDrag)}>
        <DialogTrigger
          render={
            <IconButton
              size="bar"
              aria-label="설정"
              aria-haspopup="dialog"
              icon={<SettingsIcon />}
              {...stylex.props(styles.trigger)}
            />
          }
        />
      </span>
      <DialogContent
        size="lg"
        showCloseButton={false}
        aria-labelledby={titleId}
        {...stylex.props(styles.dialog)}
      >
        {/* 대화상자는 테마를 따르는 면이라 카드 전용 꺾쇠 대신 border.strong 꺾쇠를 직접 둔다. */}
        {corners.map((position, index) => (
          // 네 모서리는 순서가 바뀌지 않는 고정 목록이다.
          <span key={index} aria-hidden="true" {...stylex.props(styles.corner, position)} />
        ))}
        <div {...stylex.props(styles.header)}>
          <h2 id={titleId} {...stylex.props(styles.title)}>
            설정
          </h2>
          <IconButton
            size="bar"
            aria-label="닫기"
            icon={<CloseIcon {...stylex.props(styles.closeIcon)} />}
            onClick={() => setOpen(false)}
          />
        </div>
        {open && (
          <div {...stylex.props(styles.body)}>
            <nav aria-label="설정 메뉴" {...stylex.props(styles.sidebar)}>
              {menus.map((menu) => {
                const current = selectedMenu === menu.id

                return (
                  <button
                    key={menu.id}
                    type="button"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => setSelectedMenu(menu.id)}
                    {...stylex.props(
                      styles.menu,
                      current && styles.menuCurrent,
                      current && shapes.cutTopRight
                    )}
                  >
                    {menu.label}
                  </button>
                )
              })}
              <div {...stylex.props(styles.sidebarEnd)}>
                {account}
                <div {...stylex.props(styles.appName)}>
                  <span aria-hidden="true" {...stylex.props(styles.appMark, shapes.cutTopRight)} />
                  {PRODUCT_NAME} Desktop
                </div>
              </div>
            </nav>
            <section
              aria-label={menus.find((menu) => menu.id === selectedMenu)?.label}
              {...stylex.props(styles.content)}
            >
              {selectedMenu === 'licenses' ? renderLicenses() : renderDeveloperMode()}
            </section>
          </div>
        )}
      </DialogContent>
    </DialogRoot>
  )
}
