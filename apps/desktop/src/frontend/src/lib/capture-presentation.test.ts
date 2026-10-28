import { describe, expect, it } from 'vitest'
import {
  formatPartyCaptureStatus,
  getCaptureControlState,
  getRaidScreenCapture,
  getTopBarCaptureControls
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

describe('getTopBarCaptureControls', () => {
  const input = {
    party: {
      phase: 'selected',
      status: '파티 문구',
      sourceReady: true,
      selectedSourceId: 'window:1',
      connectionFailed: false
    },
    raid: { phase: 'recognizing', status: '공대 문구' }
  } as const

  it('같은 입력에서 보이는 화면에 따라 파티 또는 공대 회차의 단계와 문구를 고른다', () => {
    expect(getTopBarCaptureControls({ ...input, searchMode: 'party' })).toEqual({
      phase: 'selected',
      status: '파티 문구'
    })
    expect(getTopBarCaptureControls({ ...input, searchMode: 'raid' })).toEqual({
      phase: 'recognizing',
      status: '공대 문구'
    })
  })

  it('캡처 연결 실패 문구가 회차 문구보다 우선하고 단계는 화면의 단계를 둔다', () => {
    const failed = {
      ...input,
      party: { ...input.party, connectionFailed: true }
    }

    expect(getTopBarCaptureControls({ ...failed, searchMode: 'raid' })).toEqual({
      phase: 'recognizing',
      status: '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    })
    expect(
      getTopBarCaptureControls({
        ...failed,
        searchMode: 'party',
        party: { ...failed.party, selectedSourceId: '' }
      })
    ).toEqual({
      phase: 'selected',
      status: '캡처 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    })
  })

  it('게임 창을 고르기 전에는 문구를 비우고 단계는 화면의 단계를 둔다', () => {
    const unselected = {
      ...input,
      party: { ...input.party, selectedSourceId: '' }
    }

    expect(getTopBarCaptureControls({ ...unselected, searchMode: 'party' })).toEqual({
      phase: 'selected',
      status: ''
    })
  })

  it('공대 화면에서 창이 준비됐고 공대 회차 전이면 단계를 selected로 둔다', () => {
    expect(
      getTopBarCaptureControls({
        ...input,
        searchMode: 'raid',
        party: { ...input.party, phase: 'idle' },
        raid: { phase: 'idle', status: '' }
      })
    ).toEqual({ phase: 'selected', status: '' })
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
