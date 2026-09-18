type CaptureControlState = {
  starting: boolean
  active: boolean
  loading: boolean
  failed: boolean
  hasDetectedSource: boolean
}

// 캡처 진행 상태를 우선하여 모달에 표시할 상태 이름을 결정한다.
export function getCaptureControlState({
  starting,
  active,
  loading,
  failed,
  hasDetectedSource
}: CaptureControlState): string {
  if (starting) {
    return '준비 중'
  }
  if (active) {
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
  return '대기'
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
      description: '잠시 후 창 목록을 새로고침해 주세요.'
    }
  }
  if (hasOtherSources) {
    return {
      title: '던파 창을 찾지 못했어요',
      description: '게임 실행 후 새로고침하거나 다른 창을 선택하세요.'
    }
  }
  return {
    title: '던파 창을 찾지 못했어요',
    description: '게임을 실행한 뒤 창 목록을 새로고침해 주세요.'
  }
}
