import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ActionButton,
  ContentStack,
  ExampleSection,
  SupportingText,
  TextField,
  TextFieldInput
} from '@ldb/ui'
import { SEARCH_ERRORS, type ManualSearchApi } from '../../../../../preload/common/types/search'
import { CaptureSearch, emptySearchSlots, type SearchView } from '../api/capture-search'
import { validManualNickname } from '../utils/manual-input'
import { SlotResult } from './SlotResult'

type ManualSession = {
  bridge: CaptureSearch
  controller: AbortController
  started: boolean
  starting: Promise<string | null> | null
  submission: number
  nickname: string | null
}

export function ManualSearch({ api }: { api?: ManualSearchApi }): React.JSX.Element {
  const [nickname, setNickname] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [view, setView] = useState<SearchView>({
    ready: false,
    slots: emptySearchSlots(),
    retryPending: [false, false, false, false],
    connectionFailed: false
  })
  const sessionRef = useRef<ManualSession | null>(null)

  useEffect(() => {
    if (api == null) {
      return
    }
    let active = true
    const bridge = new CaptureSearch({
      api,
      notify: api.notifyManualNickname,
      onChange: (next) => {
        if (active) {
          const slot = next.slots[0]
          const isComplete = slot.state === 'success' || slot.state === 'empty'
          if (isComplete && slot.nickname === session.nickname) {
            session.nickname = null
          }
          setView(next)
        }
      },
      onInvalidated: () => {
        session.controller.abort()
        session.controller = new AbortController()
        session.started = false
        session.starting = null
        session.nickname = null
        session.submission += 1
      }
    })
    const session: ManualSession = {
      bridge,
      controller: new AbortController(),
      started: false,
      starting: null,
      submission: 0,
      nickname: null
    }
    sessionRef.current = session
    bridge.connect()
    return () => {
      active = false
      sessionRef.current = null
      session.controller.abort()
      bridge.dispose()
    }
  }, [api])

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const session = sessionRef.current
    if (session == null || !view.ready) {
      return
    }
    if (!validManualNickname(nickname)) {
      session.submission += 1
      session.nickname = null
      session.bridge.observe({ slot: 0, nickname: null })
      setFeedback(SEARCH_ERRORS.INVALID_SEARCH_QUERY.message)
      return
    }
    if (session.nickname === nickname) {
      return
    }
    session.submission += 1
    const submission = session.submission
    session.nickname = nickname
    session.bridge.observe({ slot: 0, nickname: null })
    setFeedback(null)
    if (!session.started) {
      const starting =
        session.starting ?? session.bridge.begin({ signal: session.controller.signal })
      session.starting = starting
      const id = await starting
      if (sessionRef.current !== session || session.starting !== starting) {
        return
      }
      if (id == null) {
        session.starting = null
        session.nickname = null
        setFeedback('검색을 시작하지 못했습니다. 다시 시도해 주세요.')
        return
      }
      session.started = true
    }
    if (session.submission !== submission) {
      return
    }
    session.bridge.observe({ slot: 0, nickname })
  }

  return (
    <ExampleSection title="캐릭터 직접 검색">
      <ContentStack>
        <SupportingText>게임 캡처 없이 캐릭터 닉네임으로 검색할 수 있습니다.</SupportingText>
        <form onSubmit={(event) => void submit(event)}>
          <TextField
            label="캐릭터 닉네임"
            value={nickname}
            onValueChange={({ value }) => setNickname(value)}
          >
            <TextFieldInput
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.nativeEvent.isComposing) {
                  event.preventDefault()
                }
              }}
            />
          </TextField>
          <ActionButton type="submit" disabled={api == null || !view.ready}>
            검색
          </ActionButton>
        </form>
        {feedback != null && <div role="alert">{feedback}</div>}
        {(api == null || view.connectionFailed) && (
          <SupportingText>
            검색 연결을 확인할 수 없습니다. 앱 화면을 다시 열어 주세요.
          </SupportingText>
        )}
        {view.slots[0].state !== 'idle' && (
          <SlotResult
            title="직접 검색 결과"
            slot={view.slots[0]}
            retryPending={view.retryPending[0]}
            retry={(slot) => void sessionRef.current?.bridge.retry(slot)}
          />
        )}
      </ContentStack>
    </ExampleSection>
  )
}
