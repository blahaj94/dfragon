import { PRODUCT_NAME } from '@dfragon/lib'
import brandIcon from '../../../../resources/brand.png'
import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Typo, ActionButton, DialogContent, DialogRoot, DialogTrigger } from '@dfragon/ui'
import { Switch } from '@seed-design/react'
import type { NoticeEntry } from '@dfragon/licenses/types'
import { useColorTheme } from '../hooks/useColorTheme'
import { lightTheme } from '../constants/theme.stylex'
import { OpenSourceNotices } from '../components/OpenSourceNotices'
import { SettingsIcon } from '../components/SettingsIcon'
import { IconButton } from '../components/IconButton'
import type { DeveloperModeState } from '../hooks/useDeveloperMode'
import { styles } from './SettingsSection.style'
import { BuildVersionsSection } from './BuildVersionsSection'

export function SettingsSection({
  developerMode,
  onOpenDeveloperWorkbench
}: {
  developerMode?: DeveloperModeState
  onOpenDeveloperWorkbench?: () => void
}): React.JSX.Element {
  const { light } = useColorTheme()
  const [open, setOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState<'licenses' | 'developer' | 'versions'>(
    'licenses'
  )
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

  function getDeveloperStatusText(): string {
    if (mode.updating) {
      return '개발자 모드 설정 저장 중'
    }

    if (mode.enabled) {
      return '개발자 모드 켜짐'
    }

    return '개발자 모드 꺼짐'
  }

  function renderDeveloperControls(): React.JSX.Element {
    if (mode.status === 'loading') {
      return <Typo.txtM role="status">개발자 모드 설정을 불러오는 중입니다.</Typo.txtM>
    }

    if (mode.status === 'unavailable') {
      return (
        <Typo.txtM role="status">이 실행 환경에서는 개발자 모드를 사용할 수 없습니다.</Typo.txtM>
      )
    }

    if (mode.status === 'error') {
      return (
        <div role="alert">
          <Typo.txtM>개발자 모드 설정을 불러오거나 저장하지 못했습니다.</Typo.txtM>
          <ActionButton size="small" variant="neutralWeak" onClick={mode.retry}>
            <Typo.txtS as="span" weight={700}>
              다시 시도
            </Typo.txtS>
          </ActionButton>
        </div>
      )
    }

    return (
      <>
        <Switch.Root
          size="24"
          checked={mode.enabled}
          disabled={mode.updating}
          onCheckedChange={mode.setEnabled}
          {...stylex.props(styles.developerSwitch)}
        >
          <Switch.Label>
            <Typo.txtM as="span">개발자 모드</Typo.txtM>
          </Switch.Label>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.HiddenInput />
        </Switch.Root>
        <Typo.txtS role="status" {...stylex.props(styles.developerStatus)}>
          {getDeveloperStatusText()}
        </Typo.txtS>
        {mode.enabled && onOpenDeveloperWorkbench && (
          <div {...stylex.props(styles.developerActions)}>
            <ActionButton
              size="medium"
              variant="brandSolid"
              onClick={() => {
                setOpen(false)
                onOpenDeveloperWorkbench()
              }}
            >
              <Typo.txtM as="span" weight={700}>
                개발 도구 열기
              </Typo.txtM>
            </ActionButton>
          </div>
        )}
      </>
    )
  }

  function renderSectionContent(): React.JSX.Element {
    if (selectedSection === 'versions') {
      return <BuildVersionsSection />
    }

    if (selectedSection === 'licenses') {
      if (entries) {
        return <OpenSourceNotices entries={entries} />
      }

      return (
        <>
          <Typo.h4 as="h2" {...stylex.props(styles.heading)}>
            라이선스 사용고지
          </Typo.h4>
          {failed ? (
            <div role="alert">
              <Typo.txtM>라이선스 정보를 불러오지 못했습니다.</Typo.txtM>
              <ActionButton size="small" variant="neutralWeak" onClick={() => void loadNotices()}>
                <Typo.txtS as="span" weight={700}>
                  다시 시도
                </Typo.txtS>
              </ActionButton>
            </div>
          ) : (
            <Typo.txtM role="status">라이선스 정보를 불러오는 중입니다.</Typo.txtM>
          )}
        </>
      )
    }

    return (
      <>
        <Typo.h4 as="h2" {...stylex.props(styles.heading)}>
          개발자 모드
        </Typo.h4>
        <Typo.txtS as="p" {...stylex.props(styles.developerDescription)}>
          개발 도구를 쓰려면 켜세요. 이 기기에만 저장됩니다.
        </Typo.txtS>
        {renderDeveloperControls()}
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
      <DialogTrigger asChild>
        <IconButton
          variant="ghost"
          aria-label="설정"
          aria-haspopup="dialog"
          icon={<SettingsIcon />}
        />
      </DialogTrigger>
      <DialogContent
        title={<Typo.h5 as="span">설정</Typo.h5>}
        {...stylex.props(styles.dialog, light && lightTheme)}
      >
        {open && (
          <div {...stylex.props(styles.body)}>
            <aside {...stylex.props(styles.sidebar)} aria-label="설정 메뉴">
              <Typo.caption {...stylex.props(styles.group)}>앱 정보</Typo.caption>
              <ActionButton
                size="medium"
                variant="ghost"
                aria-current={selectedSection === 'versions' ? 'page' : undefined}
                {...stylex.props(
                  styles.menu,
                  selectedSection === 'versions' && styles.menuSelected
                )}
                onClick={() => setSelectedSection('versions')}
              >
                <Typo.txtM as="span">버전 정보</Typo.txtM>
              </ActionButton>
              <ActionButton
                size="medium"
                variant="ghost"
                aria-current={selectedSection === 'licenses' ? 'page' : undefined}
                {...stylex.props(
                  styles.menu,
                  selectedSection === 'licenses' && styles.menuSelected
                )}
                onClick={() => setSelectedSection('licenses')}
              >
                <Typo.txtM as="span">라이선스 사용고지</Typo.txtM>
              </ActionButton>
              <ActionButton
                size="medium"
                variant="ghost"
                aria-current={selectedSection === 'developer' ? 'page' : undefined}
                {...stylex.props(
                  styles.menu,
                  selectedSection === 'developer' && styles.menuSelected
                )}
                onClick={() => setSelectedSection('developer')}
              >
                <Typo.txtM as="span">개발자 모드</Typo.txtM>
              </ActionButton>
              <div {...stylex.props(styles.appName)}>
                <img src={brandIcon} width={32} height={32} alt="" />
                <Typo.caption>{PRODUCT_NAME} Desktop</Typo.caption>
              </div>
            </aside>
            <div {...stylex.props(styles.content)}>{renderSectionContent()}</div>
          </div>
        )}
      </DialogContent>
    </DialogRoot>
  )
}
