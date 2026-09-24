import * as stylex from '@stylexjs/stylex'
import { ActionButton, ContentStack, SupportingText } from '@dfragon/ui'
import { SearchResults } from './SearchResults'
import { styles } from './PartyCapture.style'
import { usePartyCapture } from '../hooks/usePartyCapture'

function PartyCapture(): React.JSX.Element {
  const {
    sources,
    selectedSourceId,
    sourceRegistered,
    starting,
    search,
    retrySearch,
    intervalSeconds,
    stableNicknames,
    status,
    selectSource,
    refreshSources,
    setIntervalSeconds,
    startCapture,
    stopCapture
  } = usePartyCapture()
  const isSourceRegistered = sourceRegistered
  const isSearchReady = search.ready
  const cannotStartCapture = !isSourceRegistered || starting || !isSearchReady
  const displayLines = [
    status,
    ...stableNicknames.map((nickname, slot) => {
      const hasNickname = nickname != null
      if (!hasNickname) {
        return null
      }

      const isNicknameEmpty = nickname.length === 0
      if (isNicknameEmpty) {
        return null
      }

      return `슬롯 ${slot + 1}: ${nickname}`
    })
  ]
  const statusText = displayLines
    .filter((line): line is string => {
      const hasLine = line != null
      if (!hasLine) {
        return false
      }

      const isLineEmpty = line.length === 0
      return !isLineEmpty
    })
    .join('\n')

  return (
    <main>
      <ContentStack>
        <SupportingText>
          게임을 1920×1080 테두리 없는 창 모드·UI 배율 50%로 설정하고, 파티 닉네임이 보이게 해
          주세요. 게임 창을 최소화하지 않은 상태에서 아래 창을 선택하고 ‘캡처 시작’을 누르세요.
        </SupportingText>
        <label {...stylex.props(styles.field)}>
          게임 창
          <select value={selectedSourceId} onChange={(event) => selectSource(event.target.value)}>
            <option value="">게임 창 선택</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label {...stylex.props(styles.field)}>
          인식 간격
          <select
            value={intervalSeconds}
            onChange={(event) => setIntervalSeconds(Number(event.target.value))}
          >
            <option value={1}>1초</option>
            <option value={3}>3초</option>
            <option value={5}>5초</option>
          </select>
        </label>
        <div {...stylex.props(styles.actions)}>
          <ActionButton
            type="button"
            disabled={starting || search.captureActive}
            onClick={() => refreshSources()}
          >
            창 목록 새로고침
          </ActionButton>
          <ActionButton
            disabled={cannotStartCapture}
            loading={starting}
            type="button"
            onClick={() => void startCapture()}
          >
            캡처 시작
          </ActionButton>
          <ActionButton type="button" onClick={() => stopCapture()}>
            캡처 중지
          </ActionButton>
        </div>
        <pre role="status" {...stylex.props(styles.status)}>
          {statusText}
        </pre>
        <SupportingText>
          인식 대기가 계속되면 게임 설정과 닉네임이 보이는지 확인해 주세요. 잘못 읽은 이름은 슬롯의
          ‘닉네임 수정’으로 고칠 수 있습니다. 캡처 없이 찾으려면 위의 ‘캐릭터 직접 검색’을
          사용하세요.
        </SupportingText>
        <SearchResults view={search} retry={retrySearch} editing={search} />
      </ContentStack>
    </main>
  )
}

export default PartyCapture
