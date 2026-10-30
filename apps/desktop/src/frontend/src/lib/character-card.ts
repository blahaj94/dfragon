import type { SelectedCharacterSummary } from '../../../preload/common/types/character'
import { SEARCH_ERRORS, type SearchSlot } from '../../../preload/common/types/search'
import { serverNames } from '../constants/servers'
import { MISSING_VALUE } from '../constants/cards'
import type { CardCharacter } from '../types/cards'
import type { SearchMode } from '../types/search-mode'
import type { ServerId } from '../types/servers'

function isServerId(value: string): value is ServerId {
  return Object.hasOwn(serverNames, value)
}

export function toCharacterCard(
  summary: SelectedCharacterSummary | undefined
): CardCharacter | undefined {
  if (summary == null || !isServerId(summary.serverId)) {
    return undefined
  }
  const adventure = summary.adventureName ?? MISSING_VALUE
  const job = summary.jobGrowName ?? summary.jobName ?? MISSING_VALUE

  return {
    characterId: summary.characterId,
    name: summary.characterName,
    adventure,
    job,
    serverId: summary.serverId,
    fame: summary.fame,
    guild: summary.guildName,
    card: summary.card,
    level: summary.level,
    image: summary.imageUrl
  }
}

function raidSelectionNotice(slot: SearchSlot): string | undefined {
  if (slot.selectionMethod === 'highest-fame') {
    return '직업과 수치 미확인, 최고 명성 후보입니다.'
  }

  if (slot.choices === undefined) {
    return undefined
  }

  if (slot.selectionMethod === 'fame') {
    return '명성으로 추정한 후보입니다.'
  }

  return undefined
}

function characterSlotNotice(slot: SearchSlot, screen: SearchMode): string | undefined {
  if (slot.details === 'failed') {
    return '상세 정보를 불러오지 못했습니다. 서버와 이름을 직접 조회하면 다시 불러옵니다.'
  }
  const notice = screen === 'raid' ? raidSelectionNotice(slot) : undefined
  if (notice !== undefined) {
    return notice
  }

  if (slot.error == null) {
    return undefined
  }
  const { code } = slot.error
  if (code === 'INVALID_SEARCH_QUERY' && slot.nickname === '') {
    return '닉네임을 읽지 못했습니다. 서버와 이름을 직접 입력해 주세요.'
  }

  return SEARCH_ERRORS[code].message
}

export function searchSlotNotice(
  slot: SearchSlot,
  nextStep: string,
  screen: SearchMode = 'party'
): string | undefined {
  const notice = characterSlotNotice(slot, screen)
  if (slot.state === 'failure' || slot.state === 'empty') {
    const message = notice ?? '검색 결과가 없습니다.'

    return `${message} ${nextStep}`
  }

  return notice
}
