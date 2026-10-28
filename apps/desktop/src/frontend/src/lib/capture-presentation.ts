import type { CapturePhase } from '../types/capture'

const DNF_CAPTURE_WINDOW_TITLE_PATTERN = /던전\s*앤\s*파이터|Dungeon.*Fighter|\bDNF\b/i

export function isDnfCaptureSource(source: { name: string }): boolean {
  return DNF_CAPTURE_WINDOW_TITLE_PATTERN.test(source.name)
}

type CaptureControlInput = {
  phase: CapturePhase
  loading: boolean
  failed: boolean
  hasDetectedSource: boolean
}

type CaptureStatus = { phase: CapturePhase; status: string }

export type CaptureControlTone = 'neutral' | 'success' | 'danger' | 'warning' | 'signal'

export function getCaptureControlState({
  phase,
  loading,
  failed,
  hasDetectedSource
}: CaptureControlInput): { label: string; tone: CaptureControlTone; busy: boolean } {
  if (phase === 'selecting') {
    return { label: '준비 중', tone: 'neutral', busy: false }
  }

  if (phase === 'recognizing') {
    return { label: '인식 중', tone: 'signal', busy: true }
  }

  if (phase === 'complete') {
    return { label: '인식 완료', tone: 'signal', busy: false }
  }

  if (phase === 'unavailable') {
    return { label: '확인 필요', tone: 'warning', busy: false }
  }

  if (phase === 'failed') {
    return { label: '캡처 실패', tone: 'danger', busy: false }
  }

  if (loading) {
    return { label: '창 확인 중', tone: 'neutral', busy: false }
  }

  if (failed) {
    return { label: '조회 실패', tone: 'danger', busy: false }
  }

  if (!hasDetectedSource) {
    return { label: '창 미감지', tone: 'warning', busy: false }
  }

  return { label: '창 감지됨', tone: 'success', busy: false }
}

function getRaidScreenCapture({
  party,
  raid
}: {
  party: CaptureStatus & { sourceReady: boolean }
  raid: CaptureStatus
}): CaptureStatus {
  if (!party.sourceReady) {
    return { phase: party.phase, status: party.status }
  }

  if (raid.phase === 'idle') {
    return { phase: 'selected', status: raid.status }
  }

  return { phase: raid.phase, status: raid.status }
}

export function getTopBarCaptureControls({
  isRaidMode,
  party,
  raid
}: {
  isRaidMode: boolean
  party: CaptureStatus & {
    sourceReady: boolean
    selectedSourceId: string
    connectionFailed: boolean
  }
  raid: CaptureStatus
}): CaptureStatus {
  const screenCapture = isRaidMode
    ? getRaidScreenCapture({ party, raid })
    : { phase: party.phase, status: party.status }

  if (party.connectionFailed) {
    return {
      phase: screenCapture.phase,
      status: '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    }
  }

  if (!party.selectedSourceId) {
    return { phase: screenCapture.phase, status: '' }
  }

  return screenCapture
}
