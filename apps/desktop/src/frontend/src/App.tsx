import { PRODUCT_NAME } from '@dfragon/lib'
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
import { useUpdateNotice } from './hooks/useUpdateNotice'
import { UpdateNotice } from './components/UpdateNotice'
import { styles } from './App.style'
import brandIcon from '../../../resources/brand.png'
import { characterSlotNotice, toCharacterCard } from './lib/character-card'

function App(): React.JSX.Element {
  const { light } = useColorTheme()
  const developerMode = useDeveloperMode()
  const capture = usePartyCapture({ identifyCharacters: true })
  const updateNotice = useUpdateNotice()
  // 로그인 설정이 없는 빌드는 preload가 인증 API를 노출하지 않는다.
  const authApi = window.auth
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
  const slotNotices = capture.search.slots.map((slot) => {
    const notice = characterSlotNotice(slot)
    if (slot.state === 'failure' || slot.state === 'empty') {
      const message = notice ?? '검색 결과가 없습니다.'

      return `${message} Alt+R로 다시 인식하거나 서버와 이름을 직접 조회해 주세요.`
    }

    return notice
  })

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
        {updateNotice.notice != null && (
          <UpdateNotice
            tag={updateNotice.notice.tag}
            endsOcrCollection={updateNotice.notice.endsOcrCollection}
            onOpenRelease={updateNotice.openRelease}
            onDismiss={updateNotice.dismiss}
          />
        )}
        <PartyPage
          resetKey={String(capture.round)}
          slots={capture.search.slots.map((slot) => slot.state)}
          characters={capture.search.slots.map((slot) => toCharacterCard(slot.selected))}
          basicOnly
          inputEnabled
          onLookup={capture.search.lookupSlot}
          loadingSlots={capture.recognitionStates.map(
            (state, slot) =>
              !capture.search.manualSlots[slot] && (state === 'pending' || capture.starting)
          )}
          slotNotices={slotNotices}
          onSlotDetail={capture.search.openDetails}
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
          account={authApi == null ? null : <LoginSection api={authApi} />}
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
          <div {...stylex.props(styles.brand)}>
            <img src={brandIcon} width={28} height={28} alt="" />
            <Typo.caption>{PRODUCT_NAME} Desktop</Typo.caption>
          </div>
          <Typo.caption role="status">{capture.search.detailNotice || footerStatus}</Typo.caption>
        </footer>
      )}
    </main>
  )
}

export default App
