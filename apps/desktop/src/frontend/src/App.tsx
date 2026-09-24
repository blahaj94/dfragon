import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Typo } from '@dfragon/ui'
import { lightTheme } from './constants/theme.stylex'
import { useColorTheme } from './hooks/useColorTheme'
import { usePartyCapture } from './hooks/usePartyCapture'
import { CaptureControls } from './components/CaptureControls'
import { PartyPage } from './pages/party/PartyPage'
import { LoginSection } from './sections/LoginSection'
import { SettingsSection } from './sections/SettingsSection'
import { DeveloperWorkbench } from './sections/DeveloperWorkbench'
import { useDeveloperMode } from './hooks/useDeveloperMode'
import { styles } from './App.style'

function App(): React.JSX.Element {
  const { light } = useColorTheme()
  const developerMode = useDeveloperMode()
  const capture = usePartyCapture()
  const [workbenchOpen, setWorkbenchOpen] = useState(false)
  let captureNotice = ''
  if (capture.search.connectionFailed) {
    captureNotice = '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
  } else if (capture.selectedSourceId) {
    captureNotice = capture.status
  }
  const footerStatus = capture.selectedSourceId ? capture.status : '캡처 대기'
  const showDeveloperWorkbench =
    workbenchOpen && developerMode.status === 'ready' && developerMode.enabled

  function openDeveloperWorkbench(): void {
    if (developerMode.status !== 'ready' || !developerMode.enabled) {
      return
    }

    capture.stopCapture('개발 도구를 여는 동안 화면 캡처를 중지했습니다.')
    setWorkbenchOpen(true)
  }

  return (
    <main {...stylex.props(styles.app, light && lightTheme)}>
      <div hidden={showDeveloperWorkbench}>
        <PartyPage
          slots={['idle', 'idle', 'idle', 'idle']}
          nicknames={capture.stableNicknames}
          capture={
            <CaptureControls
              sources={capture.sources}
              selectedSourceId={capture.selectedSourceId}
              loading={capture.sourcesLoading}
              failed={capture.sourcesFailed}
              phase={capture.phase}
              ready={capture.search.ready}
              status={captureNotice}
              onSelect={(id) => {
                void capture.selectAndStartCapture(id)
              }}
              onRefresh={capture.refreshSources}
              onStop={() => capture.stopCapture()}
            />
          }
          account={<LoginSection api={window.auth} />}
          settings={
            <SettingsSection
              developerMode={developerMode}
              onOpenDeveloperWorkbench={openDeveloperWorkbench}
            />
          }
        />
      </div>
      {showDeveloperWorkbench && (
        <div {...stylex.props(styles.workbench)}>
          <DeveloperWorkbench onClose={() => setWorkbenchOpen(false)} />
        </div>
      )}
      {!showDeveloperWorkbench && (
        <footer {...stylex.props(styles.footer)}>
          <Typo.caption>DFRAGON Desktop</Typo.caption>
          <Typo.caption role="status">{footerStatus}</Typo.caption>
        </footer>
      )}
    </main>
  )
}

export default App
