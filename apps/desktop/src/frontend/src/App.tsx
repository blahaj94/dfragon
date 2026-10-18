import { useId, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useColorTheme } from './hooks/useColorTheme'
import { useWindowChromeTheme } from './hooks/useWindowChromeTheme'
import { usePartyCapture } from './hooks/usePartyCapture'
import { CaptureControls } from './components/CaptureControls'
import { TopBar } from './components/TopBar'
import { MainNav, type SearchMode } from './components/MainNav'
import { PartyHeader } from './components/PartyHeader'
import { usePartyCollapse } from './hooks/usePartyCollapse'
import { PartyPage } from './pages/party/PartyPage'
import { RaidPage } from './pages/raid/RaidPage'
import { useRaidSearch } from './hooks/useRaidSearch'
import { LoginSection } from './sections/LoginSection'
import { SettingsSection } from './sections/SettingsSection'
import { DeveloperWorkbench } from './sections/DeveloperWorkbench'
import { useDeveloperMode } from './hooks/useDeveloperMode'
import { useUpdateNotice } from './hooks/useUpdateNotice'
import { UpdateNotice } from './components/UpdateNotice'
import { styles } from './App.style'
import { searchSlotNotice, toCharacterCard } from './lib/character-card'

function App(): React.JSX.Element {
  const { light } = useColorTheme()
  useWindowChromeTheme(light)
  const developerMode = useDeveloperMode()
  const capture = usePartyCapture({ identifyCharacters: true })
  const raid = useRaidSearch()
  const updateNotice = useUpdateNotice()
  // 로그인 설정이 없는 빌드는 preload가 인증 API를 노출하지 않는다.
  const authApi = window.auth
  const [workbenchOpen, setWorkbenchOpen] = useState(false)
  const [searchMode, setSearchMode] = useState<SearchMode>('party')
  const party = usePartyCollapse()
  const partyCardsId = useId()
  const raidCardsId = useId()
  let captureNotice = ''
  if (capture.search.connectionFailed) {
    captureNotice = '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
  } else if (capture.selectedSourceId) {
    captureNotice = capture.status
  }
  const partyStatus = capture.selectedSourceId ? capture.status : '캡처 대기'
  const developerModeEnabled = developerMode.status === 'ready' && developerMode.enabled
  // 상단 바의 설정은 작업 공간에서도 보인다. 개발자 모드를 껐다 다시 켤 때 캡처 중지 없이
  // 작업 공간이 다시 열리지 않도록, 개발자 모드가 꺼지면 열림 상태도 닫는다.
  if (workbenchOpen && !developerModeEnabled) {
    setWorkbenchOpen(false)
  }
  const showDeveloperWorkbench = workbenchOpen && developerModeEnabled
  const filledPartySlots = capture.search.slots.filter(
    (slot) => slot.state === 'success' && slot.selected != null
  ).length
  const slotNotices = capture.search.slots.map((slot) =>
    searchSlotNotice(slot, 'Alt+R로 다시 인식하거나 서버와 이름을 직접 조회해 주세요.')
  )
  // 공대 캡처는 아직 연결하지 않아 공대 자리는 서버와 이름 조회로만 채운다.
  const raidSlotNotices = raid.slots.map((slot) =>
    searchSlotNotice(slot, '서버와 이름을 다시 조회해 주세요.')
  )
  const raidStatus = raid.connectionFailed
    ? '검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    : raid.detailNotice

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
            phase={capture.phase}
            ready={capture.search.ready}
            status={captureNotice}
            onSelect={capture.selectSource}
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
          <div hidden={searchMode !== 'party'} {...stylex.props(styles.party)}>
            <PartyHeader
              status={capture.search.detailNotice || partyStatus}
              filledCount={filledPartySlots}
              lastCapturedAt={capture.lastCompletedAt}
              canCapture={capture.canStartCapture}
              onCapture={capture.startRound}
              collapsed={party.collapsed}
              onToggleCollapsed={party.toggleCollapsed}
              controls={partyCardsId}
            />
            <PartyPage
              id={partyCardsId}
              collapsed={party.collapsed}
              resetKey={String(capture.round)}
              slots={capture.search.slots.map((slot) => slot.state)}
              characters={capture.search.slots.map((slot) => toCharacterCard(slot.selected))}
              basicOnly
              inputEnabled
              onLookup={capture.search.lookupSlot}
              loadingSlots={capture.search.manualSlots.map(
                (manual) => !manual && capture.recognizing
              )}
              slotNotices={slotNotices}
              onSlotDetail={capture.search.openDetails}
              nicknames={capture.nicknames}
            />
          </div>
          {/* 공대 카드도 파티를 보는 동안 자리별 입력과 검색 상태를 유지하도록 숨기기만 한다. */}
          <RaidPage
            id={raidCardsId}
            hidden={searchMode !== 'raid'}
            status={raidStatus}
            slots={raid.slots.map((slot) => slot.state)}
            characters={raid.slots.map((slot) => toCharacterCard(slot.selected))}
            basicOnly
            slotNotices={raidSlotNotices}
            collapsed={party.collapsed}
            onToggleCollapsed={party.toggleCollapsed}
            onLookup={raid.lookupSlot}
            onSlotDetail={raid.openDetails}
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
