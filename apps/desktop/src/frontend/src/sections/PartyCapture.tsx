import * as stylex from '@stylexjs/stylex'
import { Button, ContentStack, SupportingText } from '@dfragon/ui'
import { SearchResults } from './SearchResults'
import { styles } from './PartyCapture.style'
import { usePartyCapture } from '../hooks/usePartyCapture'
import { formatPartyCaptureStatus } from '../lib/capture-presentation'

function PartyCapture(): React.JSX.Element {
  const {
    source,
    canStartCapture,
    recognizing,
    search,
    retrySearch,
    nicknames,
    status,
    startCapture,
    stopCapture
  } = usePartyCapture()
  const { sources, sourcesFailed, selectedSourceId, selectSource, refreshSources } = source
  const isSearchReady = search.ready
  const cannotStartCapture = !canStartCapture || !isSearchReady
  const statusText = formatPartyCaptureStatus({ status, nicknames })

  return (
    <main>
      <ContentStack>
        <SupportingText>
          게임을 테두리 없는 창 모드로 설정하고, HP, MP가 가득 찬 파티 프레임이 보이게 해 주세요.
          게임 창을 최소화하지 않은 상태에서 아래 창을 선택하고 ‘캡처 시작’을 누르세요.
        </SupportingText>
        {sourcesFailed && (
          <div role="status">
            <SupportingText>
              창 목록을 불러오지 못했습니다. 15초 뒤 다시 확인합니다. 직접 새로고침할 수도 있습니다.
            </SupportingText>
          </div>
        )}
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
        <div {...stylex.props(styles.actions)}>
          <Button
            variant="primary"
            type="button"
            disabled={recognizing || search.captureActive}
            onClick={() => refreshSources()}
          >
            창 목록 새로고침
          </Button>
          <Button
            variant="primary"
            disabled={cannotStartCapture}
            type="button"
            onClick={() => void startCapture()}
          >
            캡처 시작
          </Button>
          <Button variant="primary" type="button" onClick={() => stopCapture()}>
            캡처 중지
          </Button>
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
