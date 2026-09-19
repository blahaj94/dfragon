import { Tabs } from '@ldb/ui'
import * as stylex from '@stylexjs/stylex'
import { lightTheme } from './constants/theme.stylex'
import { useColorTheme } from './hooks/useColorTheme'
import { usePartyCapture } from './hooks/usePartyCapture'
import { CaptureControls } from './components/CaptureControls'
import { PartyPage } from './pages/party/PartyPage'
import { LoginSection } from './sections/LoginSection'
import { LicensesSection } from './sections/LicensesSection'
import { styles } from './App.style'

function App(): React.JSX.Element {
  const { light } = useColorTheme()
  const capture = usePartyCapture()
  let captureNotice = ''
  if (capture.search.connectionFailed) {
    captureNotice = '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
  } else if (capture.selectedSourceId) {
    captureNotice = capture.status
  }
  const footerStatus = capture.selectedSourceId ? capture.status : '캡처 대기'

  return (
    <main {...stylex.props(styles.app, light && lightTheme)}>
      <Tabs.Root defaultValue="party" lazyMount>
        <Tabs.List aria-label="앱 메뉴">
          <Tabs.Trigger value="party">파티</Tabs.Trigger>
          <Tabs.Trigger value="licenses">오픈소스 라이선스</Tabs.Trigger>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Content value="party">
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
          />
        </Tabs.Content>
        <Tabs.Content value="licenses">
          <LicensesSection />
        </Tabs.Content>
      </Tabs.Root>
      <footer {...stylex.props(styles.footer)}>
        <span>LDB Desktop</span>
        <span role="status">{footerStatus}</span>
      </footer>
    </main>
  )
}

export default App
