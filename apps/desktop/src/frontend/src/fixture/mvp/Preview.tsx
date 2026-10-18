import { useId, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CaptureControls } from '../../components/CaptureControls'
import { MainNav, type SearchMode } from '../../components/MainNav'
import { PartyHeader } from '../../components/PartyHeader'
import { TopBar } from '../../components/TopBar'
import { usePartyCollapse } from '../../hooks/usePartyCollapse'
import { SettingsSection } from '../../sections/SettingsSection'
import { getCaptureControlState, isDnfCaptureSource } from '../../lib/capture-presentation'
import { PartyPage } from '../../pages/party/PartyPage'
import { CharacterDetailPage } from '../../pages/character-detail/CharacterDetailPage'
import { RaidPage } from '../../pages/raid/RaidPage'
import { scenarios } from './scenarios'
import {
  getCapturePreviewSources,
  getCapturePreviewStatus,
  getCapturePreviewPhase
} from './capture-preview'
import { getCharacterPreview } from './character-preview'
import { styles } from './Preview.style'
import { previewCharacter, raidPreviewCharacters, tierPreviewCharacters } from './fixture'
import { useColorTheme } from '../../hooks/useColorTheme'
import type { CardCharacter } from '../../types/cards'

export function Preview(): React.JSX.Element {
  const query = new URLSearchParams(window.location.search)
  const { light } = useColorTheme()
  const [scenario, setScenario] = useState('states')
  const [captureState, setCaptureState] = useState('idle')
  const [source, setSource] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('party')
  const party = usePartyCollapse()
  const partyCardsId = useId()
  const raidCardsId = useId()
  const sources = getCapturePreviewSources(captureState)
  const phase = getCapturePreviewPhase(captureState)
  const captureStatus = getCaptureControlState({
    phase,
    loading: false,
    failed: false,
    hasDetectedSource: sources.some(isDnfCaptureSource)
  })
  const detail = query.get('detail') === 'sample'
  const character = getCharacterPreview(scenario, previewCharacter)
  const identification = scenario === 'identification'
  const identifiedCharacter = {
    ...character,
    characterId: 'preview-selected',
    fame: null,
    equipment: [],
    oath: []
  }
  let characters: readonly (CardCharacter | null)[] | undefined
  if (identification) {
    characters = [identifiedCharacter, null, null, null]
  } else if (scenario === 'tiers') {
    characters = tierPreviewCharacters
  }
  const openDetail = (): void => {
    const url = new URL(window.location.href)
    url.search = new URLSearchParams({
      detail: 'sample',
      theme: light ? 'light' : 'dark'
    }).toString()
    window.open(url.href, 'dfragon-mvp-detail')
  }

  if (detail) {
    return <CharacterDetailPage character={character} />
  }

  return (
    <main {...stylex.props(styles.app)}>
      <TopBar
        nav={<MainNav searchMode={searchMode} onSearchModeChange={setSearchMode} />}
        captureStatus={captureStatus}
        showCapture
        settings={<SettingsSection />}
        capture={
          <CaptureControls
            sources={sources}
            selectedSourceId={source}
            loading={false}
            failed={false}
            phase={phase}
            ready
            status={getCapturePreviewStatus(captureState)}
            onSelect={(id) => {
              setSource(id)
              setCaptureState(id ? 'selected' : 'idle')
            }}
            onRefresh={() => {}}
            onStop={() => {
              setSource('')
              setCaptureState('idle')
            }}
          />
        }
      />
      <div {...stylex.props(styles.content)}>
        <div hidden={searchMode !== 'party'} {...stylex.props(styles.page)}>
          <PartyHeader
            status={getCapturePreviewStatus(captureState) || '캡처 대기'}
            collapsed={party.collapsed}
            onToggleCollapsed={party.toggleCollapsed}
            controls={partyCardsId}
          />
          <PartyPage
            id={partyCardsId}
            collapsed={party.collapsed}
            character={character}
            characters={characters}
            basicOnly={identification}
            nicknames={identification ? [null, '얼굴대기', '기준대기', '오류예시'] : undefined}
            slotNotices={
              identification
                ? [
                    undefined,
                    undefined,
                    undefined,
                    '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
                  ]
                : undefined
            }
            onRetry={identification ? () => setScenario('pending') : undefined}
            retryEnabled={identification ? [false, false, false, true] : undefined}
            slots={scenarios[scenario]}
            resetKey={scenario}
            compareFaces={scenario === 'faces' || scenario === 'missing'}
            inputEnabled
            onDetail={openDetail}
          />
        </div>
        {searchMode === 'raid' && (
          <div {...stylex.props(styles.page)}>
            <RaidPage
              id={raidCardsId}
              characters={raidPreviewCharacters}
              collapsed={party.collapsed}
              onToggleCollapsed={party.toggleCollapsed}
            />
          </div>
        )}
        <footer {...stylex.props(styles.footer)}>
          <span>DFragon Desktop</span>
          <select
            aria-label="캡처 미리보기 상태"
            value={captureState}
            onChange={(event) => {
              const state = event.target.value
              setCaptureState(state)
              const hasSource =
                state === 'selected' ||
                state === 'complete' ||
                state === 'recognizing' ||
                state === 'unavailable'
              setSource(hasSource ? 'preview-game' : '')
            }}
            {...stylex.props(styles.select)}
          >
            <option value="idle">캡처 · 대기</option>
            <option value="selected">캡처 · 창 선택됨</option>
            <option value="recognizing">캡처 · 인식 중</option>
            <option value="complete">캡처 · 인식 완료</option>
            <option value="unavailable">캡처 · 확인 필요</option>
            <option value="missing">캡처 · 창 미감지</option>
            <option value="failure">캡처 · 실패</option>
          </select>
          <select
            aria-label="미리보기 상태"
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            {...stylex.props(styles.select)}
          >
            <option value="states">기본 · 상태 비교</option>
            <option value="faces">네 면 비교</option>
            <option value="pending">검색 중 · 결과 없음</option>
            <option value="missing">누락 · 이미지 실패</option>
            <option value="identification">자동 식별 상태</option>
            <option value="tiers">상위, 랭커 단계</option>
          </select>
        </footer>
        <p {...stylex.props(styles.notice)}>
          합성 데이터 미리보기, 카드 아래 면 탭으로 넘기고, 우측 상단에서 상세를 여세요.
          <br />
          캡처 모달은 합성 창으로 동작하며 실제 화면을 캡처하지 않습니다. 이름 입력, 서버 선택은
          조작 확인용이며 검색되지 않습니다. 마법부여 등급은 디자인 예시입니다.
        </p>
      </div>
    </main>
  )
}
