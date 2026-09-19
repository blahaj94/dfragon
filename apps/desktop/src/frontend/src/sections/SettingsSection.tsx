import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, DialogContent, DialogRoot, DialogTrigger } from '@ldb/ui'
import type { NoticeEntry } from '@ldb/licenses/types'
import { useColorTheme } from '../hooks/useColorTheme'
import { lightTheme } from '../constants/theme.stylex'
import { OpenSourceNotices } from '../components/OpenSourceNotices'
import { styles } from './SettingsSection.style'

export function SettingsSection(): React.JSX.Element {
  const { light } = useColorTheme()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<NoticeEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  async function loadNotices(): Promise<void> {
    setFailed(false)
    try {
      const catalog = await import('virtual:ldb-desktop-licenses')
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
      <DialogContent title="설정" {...stylex.props(styles.dialog, light && lightTheme)}>
        {open && (
          <div {...stylex.props(styles.body)}>
            <aside {...stylex.props(styles.sidebar)} aria-label="설정 메뉴">
              <span {...stylex.props(styles.group)}>앱 정보</span>
              <span
                aria-current="page"
                {...stylex.props(styles.selected, light && styles.selectedLight)}
              >
                라이선스 사용고지
              </span>
              <span {...stylex.props(styles.appName)}>LDB Desktop</span>
            </aside>
            <div {...stylex.props(styles.content)}>
              {entries ? (
                <OpenSourceNotices entries={entries} />
              ) : (
                <>
                  <h2 {...stylex.props(styles.heading)}>라이선스 사용고지</h2>
                  {failed ? (
                    <div role="alert">
                      <p>라이선스 정보를 불러오지 못했습니다.</p>
                      <ActionButton
                        size="small"
                        variant="neutralWeak"
                        onClick={() => void loadNotices()}
                      >
                        다시 시도
                      </ActionButton>
                    </div>
                  ) : (
                    <p role="status">라이선스 정보를 불러오는 중입니다.</p>
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
