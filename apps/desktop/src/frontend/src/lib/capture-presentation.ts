import { filter, join, map, pipe } from 'remeda'
import type { CapturePhase } from '../types/capture'

const DNF_CAPTURE_WINDOW_TITLE_PATTERN = /던전\s*앤\s*파이터|Dungeon.*Fighter|\bDNF\b/i

/** 창 제목에서 던파 후보를 분류한다. 프로세스 확인이나 캡처 권한을 의미하지 않는다. */
export function isDnfCaptureSource(source: { name: string }): boolean {
  return DNF_CAPTURE_WINDOW_TITLE_PATTERN.test(source.name)
}

type CaptureControlInput = {
  phase: CapturePhase
  loading: boolean
  failed: boolean
  hasDetectedSource: boolean
}

// `@dfragon/ui` StatusBadge의 tone이다. lib는 UI 계층을 import하지 않으므로 같은 이름을 따로 두고,
// CaptureControls의 tone 전달에서 이 값이 StatusBadgeTone에 속하는지 타입 검사가 확인한다. 디자인
// StatusBadge의 info, success, danger는 각각 informative, positive, critical에 대응한다.
export type CaptureControlTone = 'neutral' | 'informative' | 'positive' | 'warning' | 'critical'

// 캡처 진행 상태를 우선하여 모달에 표시할 상태 이름과 배지 tone을 결정한다.
export function getCaptureControlState({
  phase,
  loading,
  failed,
  hasDetectedSource
}: CaptureControlInput): { label: string; tone: CaptureControlTone } {
  if (phase === 'selecting' || phase === 'starting') {
    return { label: '준비 중', tone: 'neutral' }
  }

  if (phase === 'active') {
    return { label: '캡처 중', tone: 'informative' }
  }

  if (loading) {
    return { label: '창 확인 중', tone: 'neutral' }
  }

  if (failed) {
    return { label: '조회 실패', tone: 'critical' }
  }

  if (!hasDetectedSource) {
    return { label: '창 미감지', tone: 'warning' }
  }

  return { label: '창 감지됨', tone: 'positive' }
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
      title: '창 목록을 불러오지 못했습니다',
      description: '15초마다 다시 확인합니다. 직접 새로고침할 수도 있습니다.'
    }
  }

  if (hasOtherSources) {
    return {
      title: '던파 창 미감지',
      description: '15초마다 자동으로 다시 찾습니다.'
    }
  }

  return {
    title: '던파 창 미감지',
    description: '게임을 실행하면 15초마다 자동으로 찾습니다.'
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
