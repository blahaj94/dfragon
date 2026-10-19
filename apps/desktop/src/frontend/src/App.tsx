import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useColorTheme } from './hooks/useColorTheme'
import { useWindowChromeTheme } from './hooks/useWindowChromeTheme'
import { usePartyCapture } from './hooks/usePartyCapture'
import { CaptureControls } from './components/CaptureControls'
import { TopBar } from './components/TopBar'
import { MainNav, type SearchMode } from './components/MainNav'
import { usePartyCollapse } from './hooks/usePartyCollapse'
import { PartyScreen } from './pages/party/PartyScreen'
import { RaidScreen } from './pages/raid/RaidScreen'
import { useRaidCapture } from './hooks/useRaidCapture'
import { LoginSection } from './sections/LoginSection'
import { SettingsSection } from './sections/SettingsSection'
import { DeveloperWorkbench } from './sections/DeveloperWorkbench'
import { useDeveloperMode } from './hooks/useDeveloperMode'
import { useUpdateNotice } from './hooks/useUpdateNotice'
import { UpdateNotice } from './components/UpdateNotice'
import { styles } from './App.style'
import { getRaidScreenCapture } from './lib/capture-presentation'
import { MAIN_WINDOW_SIZE } from '../../preload/common/window-chrome'

function App(): React.JSX.Element {
  const { light } = useColorTheme()
  useWindowChromeTheme(light)
  const developerMode = useDeveloperMode()
  const [searchMode, setSearchMode] = useState<SearchMode>('party')
  // Alt+R은 지금 보이는 화면의 회차만 시작한다. 게임 창 선택과 중지는 파티 캡처가 소유한다.
  const capture = usePartyCapture({
    identifyCharacters: true,
    receivesShortcut: searchMode === 'party'
  })
  const raidCapture = useRaidCapture({
    sourceId: capture.selectedSourceId,
    sourceReady: capture.sourceReady,
    receivesShortcut: searchMode === 'raid'
  })
  const updateNotice = useUpdateNotice()
  // 로그인 설정이 없는 빌드는 preload가 인증 API를 노출하지 않는다.
  const authApi = window.auth
  const [workbenchOpen, setWorkbenchOpen] = useState(false)
  // 접힘은 파티와 공대가 함께 쓰고, 접은 창 높이는 보이는 화면을 따른다.
  const party = usePartyCollapse(
    searchMode === 'raid' ? MAIN_WINDOW_SIZE.raidCollapsedHeight : MAIN_WINDOW_SIZE.collapsedHeight
  )
  const raidScreenCapture = getRaidScreenCapture({
    party: { phase: capture.phase, status: capture.status, sourceReady: capture.sourceReady },
    raid: { phase: raidCapture.phase, status: raidCapture.status }
  })
  // 상태 칩과 캡처 모달은 보이는 화면의 회차를 알린다.
  const screenCapture =
    searchMode === 'raid' ? raidScreenCapture : { phase: capture.phase, status: capture.status }
  let captureNotice = ''
  if (capture.search.connectionFailed) {
    captureNotice = '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
  } else if (capture.selectedSourceId) {
    captureNotice = screenCapture.status
  }
  const developerModeEnabled = developerMode.status === 'ready' && developerMode.enabled
  // 상단 바의 설정은 작업 공간에서도 보인다. 개발자 모드를 껐다 다시 켤 때 캡처 중지 없이
  // 작업 공간이 다시 열리지 않도록, 개발자 모드가 꺼지면 열림 상태도 닫는다.
  if (workbenchOpen && !developerModeEnabled) {
    setWorkbenchOpen(false)
  }
  const showDeveloperWorkbench = workbenchOpen && developerModeEnabled
  function openDeveloperWorkbench(): void {
    if (!developerModeEnabled) {
      return
    }

    capture.stopCapture('개발 도구를 여는 동안 화면 캡처를 중지했습니다.')
    setWorkbenchOpen(true)
  }

  return (
    <main {...stylex.props(styles.app)}>
      <TopBar
        nav={
          showDeveloperWorkbench ? null : (
            <MainNav searchMode={searchMode} onSearchModeChange={setSearchMode} />
          )
        }
        showCapture={!showDeveloperWorkbench}
        capture={
          <CaptureControls
            sources={capture.sources}
            selectedSourceId={capture.selectedSourceId}
            loading={capture.sourcesLoading}
            failed={capture.sourcesFailed}
            phase={screenCapture.phase}
            ready={capture.search.ready}
            status={captureNotice}
            onSelect={capture.selectSource}
            onRefresh={capture.refreshSources}
            onStop={() => capture.stopCapture()}
          />
        }
        settings={
          <SettingsSection
            account={authApi == null ? null : <LoginSection api={authApi} />}
            developerMode={developerMode}
            onOpenDeveloperWorkbench={openDeveloperWorkbench}
          />
        }
      />
      <div {...stylex.props(styles.content)}>
        <div hidden={showDeveloperWorkbench} {...stylex.props(styles.page)}>
          {updateNotice.notice != null && (
            <UpdateNotice
              tag={updateNotice.notice.tag}
              endsOcrCollection={updateNotice.notice.endsOcrCollection}
              onOpenRelease={updateNotice.openRelease}
              onDismiss={updateNotice.dismiss}
            />
          )}
          {/* 파티 카드는 공대를 보는 동안에도 상태를 유지하도록 숨기기만 한다. */}
          <PartyScreen
            capture={capture}
            hidden={searchMode !== 'party'}
            collapse={party}
          />
          {/* 공대 카드도 파티를 보는 동안 자리별 입력과 검색 상태를 유지하도록 숨기기만 한다. */}
          <RaidScreen
            capture={raidCapture}
            hidden={searchMode !== 'raid'}
            collapse={party}
          />
        </div>
        {showDeveloperWorkbench && (
          <div {...stylex.props(styles.workbench)}>
            <DeveloperWorkbench onClose={() => setWorkbenchOpen(false)} />
          </div>
        )}
      </div>
    </main>
  )
}

export default App
