import { filter, join, map, pipe } from 'remeda'
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

export function getTopBarCaptureControls({
  searchMode,
  party,
  raid
}: {
  searchMode: 'party' | 'raid'
  party: {
    phase: CapturePhase
    status: string
    sourceReady: boolean
    selectedSourceId: string
    connectionFailed: boolean
  }
  raid: { phase: CapturePhase; status: string }
}): { phase: CapturePhase; status: string } {
  const screenCapture =
    searchMode === 'raid'
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
