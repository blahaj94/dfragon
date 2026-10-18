import { describe, expect, it } from 'vitest'
import { formatPartyCaptureStatus, getCaptureControlState } from './capture-presentation'

describe('getCaptureControlState', () => {
  const idle = { phase: 'idle', loading: false, failed: false, hasDetectedSource: true } as const

  // dfragon-design colors.md의 상태 표현 네 톤이다. 주의 색이 없어 확인 필요, 창 미감지는 waiting이다.
  it.each([
    ['준비 중', { ...idle, phase: 'selecting', loading: true }, 'neutral'],
    ['인식 중', { ...idle, phase: 'recognizing', loading: true }, 'neutral'],
    ['인식 완료', { ...idle, phase: 'complete', failed: true }, 'neutral'],
    ['확인 필요', { ...idle, phase: 'unavailable', loading: true }, 'waiting'],
    ['창 확인 중', { ...idle, loading: true, failed: true }, 'neutral'],
    ['조회 실패', { ...idle, failed: true, hasDetectedSource: false }, 'danger'],
    ['창 미감지', { ...idle, hasDetectedSource: false }, 'waiting'],
    ['창 감지됨', idle, 'success']
  ] as const)('%s 상태를 우선순위대로 고르고 상태 칩 tone을 함께 정한다', (label, input, tone) => {
    expect(getCaptureControlState(input)).toEqual({ label, tone })
  })
})

describe('formatPartyCaptureStatus', () => {
  it('omits an empty status without separators for empty slots', () => {
    expect(formatPartyCaptureStatus({ status: '', nicknames: [null, '', 'Alice', null] })).toBe(
      '슬롯 3: Alice'
    )
    expect(formatPartyCaptureStatus({ status: '', nicknames: [null, ''] })).toBe('')
  })

  it('preserves whitespace and embedded newlines in status and nicknames', () => {
    expect(
      formatPartyCaptureStatus({
        status: ' Capture\nready. ',
        nicknames: [' ', null, 'Alice\nBob', '']
      })
    ).toBe(' Capture\nready. \n슬롯 1:  \n슬롯 3: Alice\nBob')
  })
})
