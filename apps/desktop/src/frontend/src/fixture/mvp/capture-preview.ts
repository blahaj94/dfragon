import type { CapturePhase } from '../../types/capture'

export function getCapturePreviewSources(state: string): { id: string; name: string }[] {
  if (state === 'missing') {
    return [{ id: 'preview-window', name: '테스트 창' }]
  }

  return [
    { id: 'preview-game', name: '던전앤파이터' },
    { id: 'preview-window', name: '테스트 창' }
  ]
}

export function getCapturePreviewStatus(state: string): string {
  if (state === 'selected') {
    return 'Alt+R을 눌러 파티를 인식해 주세요.'
  }

  if (state === 'unavailable') {
    return '게임 창이 가려져 있습니다. 게임 창을 앞으로 가져온 뒤 Alt+R을 누르세요.'
  }

  if (state === 'failure') {
    return '선택한 창에서 영상을 받지 못했습니다. 창을 다시 선택해 주세요.'
  }

  return ''
}

const SOURCE_PHASES = [
  'selecting',
  'selected',
  'recognizing',
  'complete',
  'unavailable'
] as const satisfies readonly CapturePhase[]

type SourcePhase = (typeof SOURCE_PHASES)[number]

export function hasCapturePreviewSource(state: string): state is SourcePhase {
  return SOURCE_PHASES.some((phase) => phase === state)
}

export function canCapturePreview(state: string): boolean {
  if (state === 'selecting') {
    return false
  }

  return hasCapturePreviewSource(state)
}

export function getCapturePreviewPhase(state: string): CapturePhase {
  if (hasCapturePreviewSource(state)) {
    return state
  }

  if (state === 'failure') {
    return 'failed'
  }

  return 'idle'
}
