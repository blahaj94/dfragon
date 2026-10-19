import type { SelectedCharacterSummary } from '../../../preload/common/types/character'
import { SEARCH_ERRORS, type SearchSlot } from '../../../preload/common/types/search'
import { serverNames } from '../constants/servers'
import { MISSING_VALUE } from '../constants/cards'
import type { CardCharacter } from '../types/cards'
import type { ServerId } from '../types/servers'

/** 화면이 지원하는 서버인지 확인한다. */
function isServerId(value: string): value is ServerId {
  return Object.hasOwn(serverNames, value)
}

/** 식별된 기본 정보와 main이 검증한 카드 값만 카드 값으로 옮기고 미수신 값이나 장비 평가를 만들어내지 않는다. */
export function toCharacterCard(
  summary: SelectedCharacterSummary | undefined
): CardCharacter | null {
  if (summary == null || !isServerId(summary.serverId)) {
    return null
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
  // 후보 줄이 있으면 줄이 확정하지 못했다는 표시라 같은 뜻의 문구를 겹치지 않는다.
  if (slot.selectionMethod === 'highest-fame' && slot.choices === undefined) {
    return '외형 미확인, 최고 명성 후보입니다.'
  }

  if (slot.error == null) {
    return undefined
  }
  const { code, retryAfterSeconds } = slot.error
  if (code === 'INVALID_SEARCH_QUERY' && slot.nickname === '') {
    return '닉네임을 읽지 못했습니다. 서버와 이름을 직접 입력해 주세요.'
  }

  if (code === 'SEARCH_RATE_LIMITED' && retryAfterSeconds != null && retryAfterSeconds > 0) {
    return `${retryAfterSeconds}초 후 다시 시도할 수 있습니다.`
  }

  return SEARCH_ERRORS[code].message
}

/** 실패와 결과 0건 카드의 안내에 다음 조회 방법을 덧붙인다. 그 밖의 상태는 정제된 안내만 쓴다. */
export function searchSlotNotice(slot: SearchSlot, nextStep: string): string | undefined {
  const notice = characterSlotNotice(slot)
  if (slot.state === 'failure' || slot.state === 'empty') {
    const message = notice ?? '검색 결과가 없습니다.'

    return `${message} ${nextStep}`
  }

  return notice
}
