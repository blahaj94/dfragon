import { useState } from 'react'
import type { CardCharacter } from '../types/cards'

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
 * 규칙을 쓴다.
 */
export function useLookupDraft({
  character,
  nickname,
  onLookup
}: {
  character?: Pick<CardCharacter, 'name' | 'serverId'>
  nickname?: string
  onLookup?: (nickname: string, serverId: string) => void
}): LookupDraft {
  const [name, setName] = useState(nickname ?? character?.name ?? '')
  const [serverId, setServerId] = useState<string>(character?.serverId ?? '')
  const [dirty, setDirty] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const [submitted, setSubmitted] = useState<{ nickname: string; serverId: string } | null>(null)
  const [inputNotice, setInputNotice] = useState('')
  const incomingName = character?.name ?? nickname
  const incomingServerId = character?.serverId
  const [previousSource, setPreviousSource] = useState({
    name: incomingName,
    serverId: incomingServerId
  })
  const acceptsSource =
    submitted === null ||
    (character?.name === submitted.nickname && character?.serverId === submitted.serverId)
  if (previousSource.name !== incomingName || previousSource.serverId !== incomingServerId) {
    setPreviousSource({ name: incomingName, serverId: incomingServerId })
    if (!dirty && acceptsSource) {
      if (incomingName !== undefined) {
        setName(incomingName)
      }

      if (incomingServerId !== undefined) {
        setServerId(incomingServerId)
      }
    }
  }
  const editing = character != null && (name !== character.name || serverId !== character.serverId)
  const active = nameFocused || dirty || editing

  function submit(nextServerId = serverId): void {
    if (nextServerId.length === 0) {
      setInputNotice('서버를 선택해 주세요.')

      return
    }

    if (name.trim().length === 0) {
      setInputNotice('캐릭터 이름을 입력해 주세요.')

      return
    }
    const trimmed = name.trim()
    setDirty(false)
    setName(trimmed)
    setSubmitted({ nickname: trimmed, serverId: nextServerId })
    setInputNotice('')
    onLookup?.(trimmed, nextServerId)
  }

  return {
    name,
    serverId,
    inputNotice,
    editing,
    active,
    changeName: (value) => {
      setDirty(true)
      setName(value)
      setInputNotice('')
    },
    changeServer: (value) => {
      setDirty(true)
      setServerId(value)
      submit(value)
    },
    focusName: () => setNameFocused(true),
    blurName: () => setNameFocused(false),
    submit: () => submit()
  }
}
