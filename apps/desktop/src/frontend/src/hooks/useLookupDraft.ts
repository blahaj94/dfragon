import { useEffect, useState } from 'react'
import type { CardCharacter } from '../types/cards'
import {
  type SlotCardKey,
  type StoredLookupDraft,
  useSlotCardState,
  useSlotCardStore
} from './useSlotCardStore'

type LookupTarget = { name?: string; serverId?: string }

type LookupDraft = {
  name: string
  serverId: string
  inputNotice: string
  editing: boolean
  active: boolean
  changeName: (name: string) => void
  changeServer: (serverId: string) => void
  focusName: () => void
  blurName: () => void
  submit: () => void
}

/**
 * 캐릭터 카드의 서버, 이름 입력 초안. 사용자가 고치는 동안에는 새 검색 결과나 인식한 이름으로 초안을
 * 덮지 않고, 조회를 확정한 뒤에는 그 서버와 이름의 결과만 받아들인다. 파티 카드와 공대 카드가 같은 입력
 * 규칙을 쓴다. 초안은 카드와 회차별로 store에 두어 다른 화면을 보고 와도 이어진다.
 */
export function useLookupDraft({
  cardKey,
  character,
  nickname,
  onLookup
}: {
  cardKey: SlotCardKey
  character?: Pick<CardCharacter, 'name' | 'serverId'>
  nickname?: string
  onLookup?: (nickname: string, serverId: string) => void
}): LookupDraft {
  const stored = useSlotCardState(cardKey).lookupDraft
  const updateSlotCard = useSlotCardStore((state) => state.updateSlotCard)
  const [nameFocused, setNameFocused] = useState(false)
  const source = { name: character?.name ?? nickname, serverId: character?.serverId }
  const draft = followSource(
    stored ?? createDraft({ character, nickname, source }),
    source,
    character
  )

  // 들어온 값을 따라간 초안은 렌더 중에 store에 쓸 수 없으므로 그린 뒤 저장해, 다음 값과는 저장한 초안으로 비교한다.
  useEffect(() => {
    if (draft !== stored) {
      updateSlotCard(cardKey, { lookupDraft: draft })
    }
  })

  function save(next: StoredLookupDraft): void {
    updateSlotCard(cardKey, { lookupDraft: next })
  }

  function submit(base: StoredLookupDraft, serverId: string): void {
    if (serverId.length === 0) {
      save({ ...base, inputNotice: '서버를 선택해 주세요.' })

      return
    }

    if (base.name.trim().length === 0) {
      save({ ...base, inputNotice: '캐릭터 이름을 입력해 주세요.' })

      return
    }
    const trimmed = base.name.trim()
    save({
      ...base,
      name: trimmed,
      dirty: false,
      submitted: { name: trimmed, serverId },
      inputNotice: ''
    })
    onLookup?.(trimmed, serverId)
  }

  const editing =
    character != null && (draft.name !== character.name || draft.serverId !== character.serverId)
  const active = nameFocused || draft.dirty || editing

  return {
    name: draft.name,
    serverId: draft.serverId,
    inputNotice: draft.inputNotice,
    editing,
    active,
    changeName: (value) => save({ ...draft, name: value, dirty: true, inputNotice: '' }),
    changeServer: (value) => submit({ ...draft, serverId: value, dirty: true }, value),
    focusName: () => setNameFocused(true),
    blurName: () => setNameFocused(false),
    submit: () => submit(draft, draft.serverId)
  }
}

function createDraft({
  character,
  nickname,
  source
}: {
  character?: Pick<CardCharacter, 'name' | 'serverId'>
  nickname?: string
  source: StoredLookupDraft['source']
}): StoredLookupDraft {
  const name = nickname ?? character?.name ?? ''
  const serverId = character?.serverId ?? ''

  return {
    name,
    serverId,
    dirty: false,
    submitted: null,
    inputNotice: '',
    source
  }
}

function followSource(
  draft: StoredLookupDraft,
  source: StoredLookupDraft['source'],
  character?: Pick<CardCharacter, 'name' | 'serverId'>
): StoredLookupDraft {
  if (isSameTarget(draft.source, source)) {
    return draft
  }

  if (keepsUserInput(draft, character)) {
    return { ...draft, source }
  }
  const name = source.name ?? draft.name
  const serverId = source.serverId ?? draft.serverId

  return { ...draft, source, name, serverId }
}

function keepsUserInput(
  draft: StoredLookupDraft,
  character?: Pick<CardCharacter, 'name' | 'serverId'>
): boolean {
  if (draft.dirty) {
    return true
  }

  if (draft.submitted === null) {
    return false
  }

  return !isSameTarget(draft.submitted, character ?? {})
}

function isSameTarget(a: LookupTarget, b: LookupTarget): boolean {
  return a.name === b.name && a.serverId === b.serverId
}
