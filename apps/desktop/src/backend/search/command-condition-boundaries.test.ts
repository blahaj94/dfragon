import { describe, expect, it, vi } from 'vitest'
import { parseSearchControl, parseSearchObservation } from './commands'
import { deferred } from '../auth/auth-test-fixtures'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'

const captureId = '00000000-0000-4000-8000-000000000011'
const requestId = '00000000-0000-4000-8000-000000000012'
const clear = { action: 'clear', captureId, slot: 0, observationRevision: 1 }
const observation = { captureId, slot: 0, observationRevision: 1, nickname: '가나' }

describe('검색 IPC 명령 입력 경계', () => {
  it.each([
    ['조회', { action: 'read' }],
    ['시작', { action: 'begin' }],
    ['종료', { action: 'end', captureId }],
    ['첫 슬롯 비우기', clear],
    [
      '마지막 슬롯의 안전 정수 상한 관측',
      { ...clear, slot: 3, observationRevision: Number.MAX_SAFE_INTEGER }
    ],
    ['수동 재시도', { action: 'retry', captureId, slot: 3, requestId }]
  ])('%s 명령의 승인된 입력을 그대로 보존한다', (_name, command) => {
    expect(parseSearchControl([structuredClone(command)])).toEqual(command)
  })

  it.each([
    ['인자 없음', []],
    ['인자 두 개', [{ action: 'read' }, null]],
    ['null', [null]],
    ['배열', [[{ action: 'read' }]]],
    ['문자열', ['read']],
    ['알 수 없는 action', [{ action: 'start' }]],
    ['조회에 추가된 필드', [{ action: 'read', captureId }]],
    ['시작에 추가된 인증 필드', [{ action: 'begin', authRunId: captureId, authRevision: 1 }]],
    ['종료 ID 누락', [{ action: 'end' }]],
    ['UUID가 아닌 종료 ID', [{ action: 'end', captureId: 'arbitrary-capture' }]],
    ['줄바꿈이 붙은 종료 ID', [{ action: 'end', captureId: captureId + '\n' }]],
    ['음수 슬롯', [{ ...clear, slot: -1 }]],
    ['범위 밖 슬롯', [{ ...clear, slot: 4 }]],
    ['소수 슬롯', [{ ...clear, slot: 0.5 }]],
    ['문자열 슬롯', [{ ...clear, slot: '0' }]],
    ['revision 0', [{ ...clear, observationRevision: 0 }]],
    ['음수 revision', [{ ...clear, observationRevision: -1 }]],
    ['소수 revision', [{ ...clear, observationRevision: 1.5 }]],
    [
      '안전 정수 상한 초과 revision',
      [{ ...clear, observationRevision: Number.MAX_SAFE_INTEGER + 1 }]
    ],
    ['무한대 revision', [{ ...clear, observationRevision: Infinity }]],
    ['NaN revision', [{ ...clear, observationRevision: NaN }]],
    ['문자열 revision', [{ ...clear, observationRevision: '1' }]],
    ['재시도 request ID 누락', [{ action: 'retry', captureId, slot: 0 }]],
    [
      '재시도에 추가된 nickname',
      [{ action: 'retry', captureId, slot: 0, requestId, nickname: '가나' }]
    ]
  ])('%s는 변환하거나 일부만 받아들이지 않는다', (_name, args) => {
    expect(parseSearchControl(structuredClone(args))).toBeNull()
  })

  it.each([
    ['필드 누락', [{ captureId, slot: 0, nickname: '가나' }]],
    ['추가 필드', [{ ...observation, unexpected: true }]],
    ['추가 인자', [observation, null]],
    ['null nickname', [{ ...observation, nickname: null }]],
    ['숫자 nickname', [{ ...observation, nickname: 12 }]],
    ['객체 nickname', [{ ...observation, nickname: { text: '가나' } }]],
    ['범위 밖 슬롯', [{ ...observation, slot: 4 }]],
    ['revision 0', [{ ...observation, observationRevision: 0 }]],
    [
      '안전 정수 상한 초과 revision',
      [{ ...observation, observationRevision: Number.MAX_SAFE_INTEGER + 1 }]
    ],
    ['UUID가 아닌 capture ID', [{ ...observation, captureId: 'other' }]]
  ])('관측의 %s도 runtime에서 거절한다', (_name, args) => {
    expect(parseSearchObservation(structuredClone(args))).toBeNull()
  })

  it('닉네임 값의 검색 가능 여부는 문자열 IPC 검증 이후 검색 수명에서 판정한다', () => {
    const input = {
      ...observation,
      slot: 3,
      observationRevision: Number.MAX_SAFE_INTEGER,
      nickname: ''
    }

    expect(parseSearchObservation([structuredClone(input)])).toEqual(input)
  })

  it.each([
    ['캡처', 'capture', 'controlCharacterSearch', 'notifyStableNicknameDetected'],
    ['직접 검색', 'manual', 'controlManualSearch', 'notifyManualNickname']
  ] as const)(
    '%s의 잘못된 명령은 현재 요청을 취소하거나 상태를 발행하지 않는다',
    async (_name, kind, controlChannel, observationChannel) => {
      const fixture = await createSearchFixture(false, kind)
      const response = deferred<Response>()
      fixture.fetchSearch.mockReturnValueOnce(response.promise)
      await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
      await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
      const pending = await fixture.read()
      const request = new Request(...fixture.fetchSearch.mock.calls[0])
      fixture.published.mockClear()

      const invalidCommands: Array<[string, unknown[]]> = [
        [controlChannel, [{ action: 'end', captureId: fixture.captureId, unexpected: true }]],
        [
          controlChannel,
          [{ action: 'clear', captureId: fixture.captureId, slot: 0, observationRevision: 0 }]
        ],
        [
          controlChannel,
          [
            {
              action: 'retry',
              captureId: fixture.captureId,
              slot: 0,
              requestId: pending.slots[0].requestId
            },
            null
          ]
        ],
        [
          observationChannel,
          [{ captureId: fixture.captureId, slot: 0, observationRevision: 2, nickname: null }]
        ]
      ]
      for (const [channel, args] of invalidCommands) {
        expect(await fixture.invoke(channel, ...structuredClone(args))).toEqual({
          ok: false,
          error: { code: 'INVALID_SEARCH_COMMAND' },
          snapshot: pending
        })
      }

      expect(request.signal.aborted).toBe(false)
      expect(fixture.fetchSearch).toHaveBeenCalledTimes(1)
      expect(fixture.published).not.toHaveBeenCalled()
      response.resolve(jsonResponse({ body: { rows: [candidate] } }))
      await vi.waitFor(async () =>
        expect((await fixture.read()).slots[0]).toEqual({
          ...pending.slots[0],
          state: 'success',
          rows: [candidate]
        })
      )
    }
  )
})
