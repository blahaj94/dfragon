import { filter, join, map, pipe } from 'remeda'
import type { CapturePhase } from '../types/capture'

/** 창 제목에서 던파 후보를 분류한다. 프로세스 확인이나 캡처 권한을 의미하지 않는다. */
export function isDnfCaptureSource(source: { name: string }): boolean {
  return /던전\s*앤\s*파이터|Dungeon.*Fighter|\bDNF\b/i.test(source.name)
}

type CaptureControlState = {
  phase: CapturePhase
  loading: boolean
  failed: boolean
  hasDetectedSource: boolean
}

// 캡처 진행 상태를 우선하여 모달에 표시할 상태 이름을 결정한다.
export function getCaptureControlState({
  phase,
  loading,
  failed,
  hasDetectedSource
}: CaptureControlState): string {
  if (phase === 'selecting' || phase === 'starting') {
    return '준비 중'
  }

  if (phase === 'active') {
    return '캡처 중'
  }

  if (loading) {
    return '창 확인 중'
  }

  if (failed) {
    return '조회 실패'
  }

  if (!hasDetectedSource) {
    return '창 미감지'
  }

  return '창 감지됨'
}

// 창 목록 조회 결과에 맞는 안내 문구를 결정한다.
export function getCaptureSourceNotice({
  failed,
  hasOtherSources
}: {
  failed: boolean
  hasOtherSources: boolean
}): { title: string; description: string } {
  if (failed) {
    return {
      title: '창 목록을 불러오지 못했어요',
      description: '15초마다 다시 확인해요. 직접 새로고침할 수도 있어요.'
    }
  }

  if (hasOtherSources) {
    return {
      title: '던파 창을 찾지 못했어요',
      description: '15초마다 자동으로 찾아요. 다른 창을 직접 선택할 수도 있어요.'
    }
  }

  return {
    title: '던파 창을 찾지 못했어요',
    description: '게임을 실행하면 15초마다 자동으로 찾아요.'
  }
}

// 상태를 첫 줄에 두고 원래 슬롯 번호와 닉네임 원문을 유지해 표시 문구를 만든다.
export function formatPartyCaptureStatus({
  status,
  stableNicknames
}: {
  status: string
  stableNicknames: readonly (string | null)[]
}): string {
  const lines = [
    status,
    ...map(stableNicknames, (nickname, slot) => {
      const line = nickname != null && nickname.length > 0 ? `슬롯 ${slot + 1}: ${nickname}` : null

      return line
    })
  ]

  return pipe(
    lines,
    filter((line): line is string => line != null && line.length > 0),
    join('\n')
  )
}
