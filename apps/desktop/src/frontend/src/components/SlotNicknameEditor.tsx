import type { SlotEditing } from '../types/search'
import { useState } from 'react'
import { ActionButton, ContentStack, SupportingText, TextField, TextFieldInput } from '@dfragon/ui'
import { SEARCH_ERRORS, type SearchSlot } from '../../../preload/common/types/search'
import { validManualNickname } from '../lib/manual-input'

export function SlotNicknameEditor({
  slot,
  active,
  editing
}: {
  slot: SearchSlot
  active: boolean
  editing: SlotEditing
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)
  const manual = active && editing.manualSlots[slot.slot]
  const samePending = slot.state === 'pending' && slot.nickname === draft
  const sameRateWait =
    slot.nickname === draft &&
    slot.error?.code === 'SEARCH_RATE_LIMITED' &&
    (slot.error.retryAfterSeconds ?? 0) > 0
  const blocked = samePending || sameRateWait
  if (!manual) {
    return (
      <ActionButton
        type="button"
        disabled={!active}
        onClick={() => {
          setDraft(slot.nickname ?? '')
          setInvalid(false)
          editing.editSlot(slot.slot)
        }}
      >
        닉네임 수정
      </ActionButton>
    )
  }
  return (
    <form
      aria-label={`슬롯 ${slot.slot + 1} 닉네임 수정`}
      onSubmit={(event) => {
        event.preventDefault()
        const valid = validManualNickname(draft)
        setInvalid(!valid)
        if (valid && !blocked) {
          editing.submitSlot(slot.slot, draft)
        }
      }}
    >
      <ContentStack>
        <TextField
          label={`슬롯 ${slot.slot + 1} 닉네임`}
          value={draft}
          onValueChange={({ value }) => {
            setDraft(value)
            setInvalid(false)
          }}
          invalid={invalid}
          errorMessage={SEARCH_ERRORS.INVALID_SEARCH_QUERY.message}
        >
          <TextFieldInput
            autoFocus
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.nativeEvent.isComposing) {
                event.preventDefault()
              }
            }}
          />
        </TextField>
        <SupportingText>
          이 슬롯의 자동 검색을 멈췄습니다. 수정한 이름으로 검색하세요.
        </SupportingText>
        <ActionButton type="submit" disabled={blocked} loading={samePending}>
          수정한 이름 검색
        </ActionButton>
        <ActionButton type="button" onClick={() => editing.resumeOcr(slot.slot)}>
          OCR 다시 사용
        </ActionButton>
      </ContentStack>
    </form>
  )
}
