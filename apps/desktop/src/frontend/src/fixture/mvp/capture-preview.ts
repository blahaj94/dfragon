import type { CapturePhase } from '../../types/capture'

// 미리보기 상태에 맞는 합성 캡처 창 목록을 반환한다.
export function getCapturePreviewSources(state: string): { id: string; name: string }[] {
  if (state === 'missing') {
    return []
  }
  return [
    { id: 'preview-game', name: '던전앤파이터' },
    { id: 'preview-window', name: '테스트 창' }
  ]
}

// 실패 시나리오에서만 캡처 오류 안내를 표시한다.
export function getCapturePreviewStatus(state: string): string {
  if (state === 'failure') {
    return '선택한 창에서 영상을 받지 못했습니다. 창을 다시 선택해 주세요.'
  }
  return ''
}

// 합성 시나리오를 제품 모달의 캡처 단계로 변환한다.
export function getCapturePreviewPhase(state: string): CapturePhase {
  if (state === 'starting' || state === 'active') {
    return state
  }
  return state === 'failure' ? 'failed' : 'idle'
}
