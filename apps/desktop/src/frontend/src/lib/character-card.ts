import type { CharacterSummary } from '../../../preload/common/types/character'
import { SEARCH_ERRORS, type SearchSlot } from '../../../preload/common/types/search'
import { serverNames } from '../constants/servers'
import type { CardCharacter } from '../types/cards'
import type { ServerId } from '../types/servers'

/** 화면이 지원하는 서버인지 확인한다. */
function isServerId(value: string): value is ServerId {
  return Object.hasOwn(serverNames, value)
}

/** 식별된 기본 정보만 카드 값으로 옮기고 미수신 값이나 장비 평가를 만들어내지 않는다. */
export function toCharacterCard(summary: CharacterSummary | undefined): CardCharacter | null {
  if (summary == null || !isServerId(summary.serverId)) {
    return null
  }
  const adventure = summary.adventureName ?? '—'
  const job = summary.jobGrowName ?? summary.jobName ?? '—'

  return {
    characterId: summary.characterId,
    name: summary.characterName,
    adventure,
    job,
    serverId: summary.serverId,
    fame: summary.fame,
    level: summary.level,
    image: summary.imageUrl,
    equipment: [],
    oath: []
  }
}

/** 현재 서버 대기 시간과 요청 상태를 반영해 사용자 재시도만 허용한다. */
export function canRetryCharacterSlot(slot: SearchSlot, retryPending: boolean): boolean {
  if (slot.state !== 'failure' || slot.error == null || retryPending) {
    return false
  }

  if (!SEARCH_ERRORS[slot.error.code].retryable) {
    return false
  }

  if (slot.error.code === 'SEARCH_RATE_LIMITED' && (slot.error.retryAfterSeconds ?? 0) > 0) {
    return false
  }

  return true
}

/** 정제된 오류와 남은 재시도 대기 시간을 카드에 표시한다. */
export function characterSlotNotice(slot: SearchSlot): string | undefined {
  if (slot.error == null) {
    return undefined
  }
  const { code, retryAfterSeconds } = slot.error
  if (code === 'SEARCH_RATE_LIMITED' && retryAfterSeconds != null && retryAfterSeconds > 0) {
    return `${retryAfterSeconds}초 후 다시 시도할 수 있습니다.`
  }

  return SEARCH_ERRORS[code].message
}
