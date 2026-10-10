import { describe, expect, it } from 'vitest'
import { formatPartyCaptureStatus, getCaptureControlState } from './capture-presentation'

describe('getCaptureControlState', () => {
  const idle = { phase: 'idle', loading: false, failed: false, hasDetectedSource: true } as const

  // 디자인 캡처 모달의 StatusBadge 톤을 공용 StatusBadge가 받는 SEED Badge tone 이름으로 옮긴 기대값이다.
  it.each([
    ['준비 중', { ...idle, phase: 'starting', loading: true }, 'neutral'],
    ['캡처 중', { ...idle, phase: 'active', failed: true }, 'informative'],
    ['창 확인 중', { ...idle, loading: true, failed: true }, 'neutral'],
    ['조회 실패', { ...idle, failed: true, hasDetectedSource: false }, 'critical'],
    ['창 미감지', { ...idle, hasDetectedSource: false }, 'warning'],
    ['창 감지됨', idle, 'positive']
  ] as const)('%s 상태를 우선순위대로 고르고 배지 tone을 함께 정한다', (label, input, tone) => {
    expect(getCaptureControlState(input)).toEqual({ label, tone })
  })
})

describe('formatPartyCaptureStatus', () => {
  it('omits an empty status without separators for empty slots', () => {
    expect(
      formatPartyCaptureStatus({ status: '', stableNicknames: [null, '', 'Alice', null] })
    ).toBe('슬롯 3: Alice')
    expect(formatPartyCaptureStatus({ status: '', stableNicknames: [null, ''] })).toBe('')
  })

  it('preserves whitespace and embedded newlines in status and nicknames', () => {
    expect(
      formatPartyCaptureStatus({
        status: ' Capture\nready. ',
        stableNicknames: [' ', null, 'Alice\nBob', '']
      })
    ).toBe(' Capture\nready. \n슬롯 1:  \n슬롯 3: Alice\nBob')
  })
})
