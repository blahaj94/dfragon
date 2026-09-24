import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Typo, ActionButton, DialogContent, DialogRoot, DialogTrigger } from '@dfragon/ui'
import type { NoticeEntry } from '@dfragon/licenses/types'
import { useColorTheme } from '../hooks/useColorTheme'
import { lightTheme } from '../constants/theme.stylex'
import { OpenSourceNotices } from '../components/OpenSourceNotices'
import type { DeveloperModeState } from '../hooks/useDeveloperMode'
import { styles } from './SettingsSection.style'

export function SettingsSection({
  developerMode,
  onOpenDeveloperWorkbench
}: {
  developerMode?: DeveloperModeState
  onOpenDeveloperWorkbench?: () => void
}): React.JSX.Element {
  const { light } = useColorTheme()
  const [open, setOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState<'licenses' | 'developer'>('licenses')
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
        <ActionButton size="small" variant="ghost" aria-label="설정" aria-haspopup="dialog">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </ActionButton>
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
                size="small"
                variant="ghost"
                aria-current={selectedSection === 'licenses' ? 'page' : undefined}
                {...stylex.props(
                  styles.menu,
                  selectedSection === 'licenses' && styles.menuSelected,
                  selectedSection === 'licenses' && light && styles.menuSelectedLight
                )}
                onClick={() => setSelectedSection('licenses')}
              >
                <Typo.txtS as="span" weight={700}>
                  라이선스 사용고지
                </Typo.txtS>
              </ActionButton>
              <ActionButton
                size="small"
                variant="ghost"
                aria-current={selectedSection === 'developer' ? 'page' : undefined}
                {...stylex.props(
                  styles.menu,
                  selectedSection === 'developer' && styles.menuSelected,
                  selectedSection === 'developer' && light && styles.menuSelectedLight
                )}
                onClick={() => setSelectedSection('developer')}
              >
                <Typo.txtS as="span" weight={700}>
                  개발자 모드
                </Typo.txtS>
              </ActionButton>
              <div {...stylex.props(styles.appName)}>
                <Typo.caption>DFRAGON Desktop</Typo.caption>
              </div>
            </aside>
            <div {...stylex.props(styles.content)}>
              {selectedSection === 'licenses' ? (
                entries ? (
                  <OpenSourceNotices entries={entries} />
                ) : (
                  <>
                    <Typo.h4 as="h2" {...stylex.props(styles.heading)}>
                      라이선스 사용고지
                    </Typo.h4>
                    {failed ? (
                      <div role="alert">
                        <Typo.txtM>라이선스 정보를 불러오지 못했습니다.</Typo.txtM>
                        <ActionButton
                          size="small"
                          variant="neutralWeak"
                          onClick={() => void loadNotices()}
                        >
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
              ) : (
                <>
                  <Typo.h4 as="h2" {...stylex.props(styles.heading)}>
                    개발자 모드
                  </Typo.h4>
                  <Typo.txtS as="p" {...stylex.props(styles.developerDescription)}>
                    개발 도구를 사용하려면 개발자 모드를 켜세요. 설정은 이 기기에 저장됩니다.
                  </Typo.txtS>
                  {mode.status === 'loading' ? (
                    <Typo.txtM role="status">개발자 모드 설정을 불러오는 중입니다.</Typo.txtM>
                  ) : mode.status === 'unavailable' ? (
                    <Typo.txtM role="status">
                      이 실행 환경에서는 개발자 모드를 사용할 수 없습니다.
                    </Typo.txtM>
                  ) : mode.status === 'error' ? (
                    <div role="alert">
                      <Typo.txtM>개발자 모드 설정을 불러오거나 저장하지 못했습니다.</Typo.txtM>
                      <ActionButton size="small" variant="neutralWeak" onClick={mode.retry}>
                        <Typo.txtS as="span" weight={700}>
                          다시 시도
                        </Typo.txtS>
                      </ActionButton>
                    </div>
                  ) : (
                    <>
                      <div {...stylex.props(styles.developerActions)}>
                        <ActionButton
                          size="small"
                          variant="neutralWeak"
                          aria-pressed={mode.enabled}
                          disabled={mode.updating}
                          onClick={() => mode.setEnabled(!mode.enabled)}
                        >
                          <Typo.txtS as="span" weight={700}>
                            {mode.enabled ? '개발자 모드 끄기' : '개발자 모드 켜기'}
                          </Typo.txtS>
                        </ActionButton>
                        {mode.enabled && onOpenDeveloperWorkbench && (
                          <ActionButton
                            size="small"
                            variant="brandSolid"
                            onClick={() => {
                              setOpen(false)
                              onOpenDeveloperWorkbench()
                            }}
                          >
                            <Typo.txtS as="span" weight={700}>
                              개발 도구 열기
                            </Typo.txtS>
                          </ActionButton>
                        )}
                      </div>
                      <Typo.txtS role="status" {...stylex.props(styles.developerStatus)}>
                        {mode.updating
                          ? '개발자 모드 설정을 저장하는 중입니다.'
                          : mode.enabled
                            ? '개발자 모드가 켜져 있습니다.'
                            : '개발자 모드가 꺼져 있습니다.'}
                      </Typo.txtS>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </DialogRoot>
  )
}
