import { describe, expect, it } from 'vitest'
import {
  formatPartyCaptureStatus,
  getCaptureControlState,
  getRaidScreenCapture
} from './capture-presentation'

describe('getCaptureControlState', () => {
  const idle = { phase: 'idle', loading: false, failed: false, hasDetectedSource: true } as const

  // DFragon 디자인 캔버스의 캡처 보드 톤이다. 진행하는 회차는 signal, 살펴야 하는 상태는 주황 warning이고,
  // 인식하는 동안만 점 세 개가 차례로 켜진다.
  it.each([
    ['준비 중', { ...idle, phase: 'selecting', loading: true }, 'neutral', false],
    ['인식 중', { ...idle, phase: 'recognizing', loading: true }, 'signal', true],
    ['인식 완료', { ...idle, phase: 'complete', failed: true }, 'signal', false],
    ['확인 필요', { ...idle, phase: 'unavailable', loading: true }, 'warning', false],
    // 창 등록이나 회차가 실패로 끝나면 창 감지 여부보다 실패를 먼저 알린다.
    ['캡처 실패', { ...idle, phase: 'failed', loading: true }, 'danger', false],
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

describe('getRaidScreenCapture', () => {
  it('공대 회차가 실패로 끝나면 파티 캡처와 같은 실패 단계와 문구를 상태 칩에 넘긴다', () => {
    const capture = getRaidScreenCapture({
      party: { phase: 'selected', status: '', sourceReady: true },
      raid: { phase: 'failed', status: '공대원창을 읽지 못했습니다.' }
    })

    expect(capture).toEqual({ phase: 'failed', status: '공대원창을 읽지 못했습니다.' })
    expect(
      getCaptureControlState({
        phase: capture.phase,
        loading: false,
        failed: false,
        hasDetectedSource: true
      }).tone
    ).toBe('danger')
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
