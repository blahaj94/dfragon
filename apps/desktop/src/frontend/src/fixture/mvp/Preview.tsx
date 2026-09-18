import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { lightTheme } from '../../constants/theme.stylex'
import { CaptureControls } from '../../components/CaptureControls'
import { PartyPage } from '../../pages/party/PartyPage'
import { CharacterDetailPage } from '../../pages/character-detail/CharacterDetailPage'
import { scenarios } from './scenarios'
import { getCapturePreviewSources, getCapturePreviewStatus } from './capture-preview'
import { getCharacterPreview } from './character-preview'
import { styles } from './Preview.style'
import { previewCharacter } from './fixture'
import { useColorTheme } from '../../hooks/useColorTheme'

export function Preview(): React.JSX.Element {
  const query = new URLSearchParams(window.location.search)
  const theme = query.get('theme')
  const { light, toggleTheme } = useColorTheme(
    theme === 'light' || theme === 'system' ? theme : 'dark'
  )
  const [scenario, setScenario] = useState('states')
  const [captureState, setCaptureState] = useState('idle')
  const [source, setSource] = useState('')
  const detail = query.get('detail') === 'sample'
  const character = getCharacterPreview(scenario, previewCharacter)
  const openDetail = (): void => {
    const url = new URL(window.location.href)
    url.search = new URLSearchParams({
      detail: 'sample',
      theme: light ? 'light' : 'dark'
    }).toString()
    window.open(url.href, 'ldb-mvp-detail')
  }

  return (
    <main
      data-seed-color-mode={light ? 'light-only' : 'dark-only'}
      {...stylex.props(styles.app, light && lightTheme)}
    >
      {detail ? (
        <CharacterDetailPage character={character} onClose={() => window.close()} />
      ) : (
        <>
          <PartyPage
            capture={
              <CaptureControls
                light={light}
                sources={getCapturePreviewSources(captureState)}
                selectedSourceId={source}
                loading={false}
                failed={false}
                starting={captureState === 'starting'}
                active={captureState === 'active'}
                ready
                status={getCapturePreviewStatus(captureState)}
                onSelect={(id) => {
                  setSource(id)
                  setCaptureState(id ? 'active' : 'idle')
                }}
                onRefresh={() => {}}
                onStop={() => {
                  setSource('')
                  setCaptureState('idle')
                }}
              />
            }
            character={character}
            slots={scenarios[scenario]}
            resetKey={scenario}
            compareFaces={scenario === 'faces' || scenario === 'missing'}
            inputEnabled
            light={light}
            onToggleTheme={toggleTheme}
            onDetail={openDetail}
          />
          <footer {...stylex.props(styles.footer)}>
            <span>LDB Desktop</span>
            <select
              aria-label="캡처 미리보기 상태"
              value={captureState}
              onChange={(event) => {
                const state = event.target.value
                setCaptureState(state)
                setSource(state === 'active' || state === 'starting' ? 'preview-game' : '')
              }}
              {...stylex.props(styles.select)}
            >
              <option value="idle">캡처 · 대기</option>
              <option value="starting">캡처 · 준비 중</option>
              <option value="active">캡처 · 캡처 중</option>
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
            </select>
          </footer>
          <p {...stylex.props(styles.notice)}>
            합성 데이터 미리보기 · 카드를 눌러 넘기고, 우측 상단에서 상세를 여세요.
            <br />
            캡처 모달은 합성 창으로 동작하며 실제 화면을 캡처하지 않습니다. 이름 입력·서버 선택은
            조작 확인용이며 검색되지 않습니다. 마법부여 등급은 디자인 예시입니다.
          </p>
        </>
      )}
    </main>
  )
}
