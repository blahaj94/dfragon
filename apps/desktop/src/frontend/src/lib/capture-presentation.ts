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

// `@dfragon/ui` StatusChip의 tone이다. lib는 UI 계층을 import하지 않으므로 같은 이름을 따로 두고,
// 상단 바와 캡처 모달의 tone 전달에서 이 값이 StatusChipTone에 속하는지 타입 검사가 확인한다. 주의
// 색은 없으므로 확인이 필요한 상태는 중립색과 모래시계의 waiting이다.
export type CaptureControlTone = 'neutral' | 'success' | 'danger' | 'waiting'

// 캡처 진행 상태를 우선하여 상단 바와 캡처 모달에 표시할 상태 이름과 상태 칩 tone을 결정한다.
export function getCaptureControlState({
  phase,
  loading,
  failed,
  hasDetectedSource
}: CaptureControlInput): { label: string; tone: CaptureControlTone } {
  if (phase === 'selecting') {
    return { label: '준비 중', tone: 'neutral' }
  }

  if (phase === 'recognizing') {
    return { label: '인식 중', tone: 'neutral' }
  }

  if (phase === 'complete') {
    return { label: '인식 완료', tone: 'neutral' }
  }

  // 가림, 최소화, 파티 프레임 미검출로 회차가 끝나면 창 감지 표시 대신 Alt+R 전 확인이 필요함을 알린다.
  if (phase === 'unavailable') {
    return { label: '확인 필요', tone: 'waiting' }
  }

  if (loading) {
    return { label: '창 확인 중', tone: 'neutral' }
  }

  if (failed) {
    return { label: '조회 실패', tone: 'danger' }
  }

  if (!hasDetectedSource) {
    return { label: '창 미감지', tone: 'waiting' }
  }

  return { label: '창 감지됨', tone: 'success' }
}

/**
 * 공대 화면에서 상단 바 상태 칩, 캡처 모달과 공대 머리가 보일 캡처 단계와 문구를 고른다. 게임 창이 등록된
 * 동안은 공대 회차의 단계와 문구를 보이며 회차 전에는 창 등록 상태(`selected`)로 둔다. 등록 전, 등록 중,
 * 등록 실패, 중지 뒤에는 창 선택을 소유한 파티 캡처의 단계와 문구를 그대로 보인다.
 */
export function getRaidScreenCapture({
  party,
  raid
}: {
  party: { phase: CapturePhase; status: string; sourceReady: boolean }
  raid: { phase: CapturePhase; status: string }
}): { phase: CapturePhase; status: string } {
  if (!party.sourceReady) {
    return { phase: party.phase, status: party.status }
  }

  if (raid.phase === 'idle') {
    return { phase: 'selected', status: raid.status }
  }

  return { phase: raid.phase, status: raid.status }
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
  nicknames
}: {
  status: string
  nicknames: readonly (string | null)[]
}): string {
  const lines = [
    status,
    ...map(nicknames, (nickname, slot) => {
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
