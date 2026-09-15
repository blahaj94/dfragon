import type { ReactNode } from 'react'
import { SlotNicknameEditor, type SlotEditing } from './SlotNicknameEditor'
import { ActionButton, ContentStack, ExampleSection, SupportingText } from '@ldb/ui'
import { SEARCH_ERRORS, type SearchSlot } from '../../../preload/common/types/search'
import type { SearchView } from './capture-search'
import { CharacterCandidates } from './CharacterCandidates'

export function SlotResult({
  slot,
  retryPending,
  retry,
  title,
  editor
}: {
  slot: SearchSlot
  retryPending: boolean
  retry: (slot: number) => void
  title?: string
  editor?: ReactNode
}): React.JSX.Element {
  const isPending = slot.state === 'pending'
  const isSuccess = slot.state === 'success'
  const isEmpty = slot.state === 'empty'
  const error = slot.error
  const isFailure = slot.state === 'failure'
  const hasError = error != null
  const shouldShowError = isFailure && hasError
  let canRetry: boolean | undefined
  let isRateLimited: boolean | undefined
  let hasRetryAfter: boolean | undefined
  let hasPositiveRetryAfter: boolean | undefined

  if (shouldShowError) {
    canRetry = SEARCH_ERRORS[error.code].retryable
    isRateLimited = error.code === 'SEARCH_RATE_LIMITED'
    if (isRateLimited) {
      const retryAfterSeconds = error.retryAfterSeconds
      const hasRetryAfterValue = retryAfterSeconds != null
      hasRetryAfter = hasRetryAfterValue
      if (hasRetryAfterValue) {
        const positiveRetryAfterSeconds = error.retryAfterSeconds
        const hasPositiveRetryAfterValue = positiveRetryAfterSeconds != null
        hasPositiveRetryAfter = hasPositiveRetryAfterValue && positiveRetryAfterSeconds > 0
      }
    }
  }

  const isWaiting = shouldShowError && isRateLimited && hasRetryAfter && hasPositiveRetryAfter
  const isBusy = isPending || retryPending
  const isRetryDisabled = isWaiting || retryPending
  const hasNickname = slot.nickname != null
  const status = isPending ? '검색 중' : isEmpty ? '검색 결과가 없습니다.' : '인식 대기'

  return (
    <section aria-label={title ?? `슬롯 ${slot.slot + 1} 검색`} aria-busy={isBusy}>
      <ExampleSection title={title ?? `슬롯 ${slot.slot + 1}`}>
        <ContentStack>
          {editor}
          {hasNickname && <SupportingText>{slot.nickname}</SupportingText>}
          <div className="character-candidates">
            <div role="status">
              {isSuccess ? (
                <SupportingText>검색 결과 {slot.rows.length}명</SupportingText>
              ) : shouldShowError ? (
                <SupportingText>{SEARCH_ERRORS[error.code].message}</SupportingText>
              ) : (
                <SupportingText>{status}</SupportingText>
              )}
            </div>
            {isSuccess && <CharacterCandidates rows={slot.rows} />}
          </div>
          {isWaiting && (
            <SupportingText>
              {error.retryAfterSeconds}초 제한 대기 후 다시 시도할 수 있습니다.
            </SupportingText>
          )}
          {canRetry && (
            <ActionButton
              type="button"
              disabled={isRetryDisabled}
              loading={retryPending}
              onClick={() => retry(slot.slot)}
            >
              다시 시도
            </ActionButton>
          )}
        </ContentStack>
      </ExampleSection>
    </section>
  )
}

export function SearchResults({
  view,
  retry,
  editing
}: {
  view: SearchView
  editing?: SlotEditing
  retry: (slot: number) => void
}): React.JSX.Element {
  return (
    <ContentStack>
      {view.connectionFailed && (
        <SupportingText>검색 연결을 확인할 수 없습니다. 앱 화면을 다시 열어 주세요.</SupportingText>
      )}
      {view.slots.map((slot) => (
        <SlotResult
          key={slot.slot}
          slot={slot}
          retryPending={view.retryPending[slot.slot]}
          retry={retry}
          editor={
            editing != null && (
              <SlotNicknameEditor
                slot={slot}
                active={view.captureActive === true}
                editing={editing}
              />
            )
          }
        />
      ))}
    </ContentStack>
  )
}
