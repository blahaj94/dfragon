import { describe, expect, it } from 'vitest'
import { formatPartyCaptureStatus, getCaptureControlState } from './capture-presentation'

describe('getCaptureControlState', () => {
  const idle = { phase: 'idle', loading: false, failed: false, hasDetectedSource: true } as const

  // DFragon 디자인 캔버스의 캡처 보드 톤이다. 진행하는 회차는 signal, 살펴야 하는 상태는 주황 warning이고,
  // 인식하는 동안만 점 세 개가 차례로 켜진다.
  it.each([
    ['준비 중', { ...idle, phase: 'selecting', loading: true }, 'neutral', false],
    ['인식 중', { ...idle, phase: 'recognizing', loading: true }, 'signal', true],
    ['인식 완료', { ...idle, phase: 'complete', failed: true }, 'signal', false],
    ['확인 필요', { ...idle, phase: 'unavailable', loading: true }, 'warning', false],
    ['창 확인 중', { ...idle, loading: true, failed: true }, 'neutral', false],
    ['조회 실패', { ...idle, failed: true, hasDetectedSource: false }, 'danger', false],
    ['창 미감지', { ...idle, hasDetectedSource: false }, 'warning', false],
    ['창 감지됨', idle, 'success', false]
  ] as const)(
    '%s 상태를 우선순위대로 고르고 상태 칩 tone과 진행 표시를 함께 정한다',
    (label, input, tone, busy) => {
      expect(getCaptureControlState(input)).toEqual({ label, tone, busy })
    }
  )
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
