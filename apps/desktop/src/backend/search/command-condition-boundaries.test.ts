import { describe, expect, it, vi } from 'vitest'
import { parseOcrSearchObservation, parseSearchControl } from './commands'
import { deferred } from '../lib/async-test-fixture'
import {
  candidate,
  candidateResponse,
  createSearchFixture,
  jsonResponse
} from './search-test-fixture'

const captureId = '00000000-0000-4000-8000-000000000011'
const lookup = {
  action: 'lookup',
  captureId,
  slot: 0,
  observationRevision: 1,
  nickname: '가나',
  serverId: 'cain'
}
const observation = {
  captureId,
  slot: 0,
  observationRevision: 1,
  nickname: '가나',
  candidateNicknames: ['가나'],
  portrait: null
}

describe('검색 IPC 명령 입력 경계', () => {
  it.each([
    ['조회', { action: 'read' }],
    ['시작', { action: 'begin' }],
    ['종료', { action: 'end', captureId }],
    ['첫 슬롯 서버 지정 조회', lookup],
    [
      '마지막 슬롯의 안전 정수 상한 관측',
      { ...lookup, slot: 3, observationRevision: Number.MAX_SAFE_INTEGER }
    ]
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
    ['음수 슬롯', [{ ...lookup, slot: -1 }]],
    ['범위 밖 슬롯', [{ ...lookup, slot: 4 }]],
    ['소수 슬롯', [{ ...lookup, slot: 0.5 }]],
    ['문자열 슬롯', [{ ...lookup, slot: '0' }]],
    ['revision 0', [{ ...lookup, observationRevision: 0 }]],
    ['음수 revision', [{ ...lookup, observationRevision: -1 }]],
    ['소수 revision', [{ ...lookup, observationRevision: 1.5 }]],
    [
      '안전 정수 상한 초과 revision',
      [{ ...lookup, observationRevision: Number.MAX_SAFE_INTEGER + 1 }]
    ],
    ['무한대 revision', [{ ...lookup, observationRevision: Infinity }]],
    ['NaN revision', [{ ...lookup, observationRevision: NaN }]],
    ['문자열 revision', [{ ...lookup, observationRevision: '1' }]]
  ])('%s는 변환하거나 일부만 받아들이지 않는다', (_name, args) => {
    expect(parseSearchControl(structuredClone(args))).toBeNull()
  })

  it.each([
    [
      '필드 누락',
      [{ captureId, slot: 0, nickname: '가나', candidateNicknames: ['가나'], portrait: null }]
    ],
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
  ])('OCR 관측의 %s도 runtime에서 거절한다', (_name, args) => {
    expect(parseOcrSearchObservation(structuredClone(args))).toBeNull()
  })

  it('닉네임 값의 검색 가능 여부는 문자열 IPC 검증 이후 검색 수명에서 판정한다', () => {
    const input = {
      ...observation,
      slot: 3,
      observationRevision: Number.MAX_SAFE_INTEGER,
      nickname: '',
      candidateNicknames: ['']
    }

    expect(parseOcrSearchObservation([structuredClone(input)])).toEqual(input)
  })

  it.each([
    ['캡처', 'capture', 'controlCharacterSearch'],
    ['직접 검색', 'manual', 'controlCharacterSearch']
  ] as const)(
    '%s의 잘못된 명령은 현재 요청을 취소하거나 상태를 발행하지 않는다',
    async (_name, kind, controlChannel) => {
      const fixture = await createSearchFixture(kind)
      const response = deferred<Response>()
      fixture.fetchSearch.mockReturnValueOnce(response.promise)
      await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
      await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
      const pending = await fixture.read()
      const request = new Request(...fixture.fetchSearch.mock.calls[0])
      fixture.published.mockClear()
      const lookup = {
        action: 'lookup',
        captureId: fixture.captureId,
        slot: 0,
        observationRevision: 2,
        nickname: '다라',
        serverId: 'cain'
      }
      const searchCommands: Array<[string, unknown[]]> =
        kind === 'capture'
          ? [
              [
                'notifyOcrCandidatesDetected',
                [
                  {
                    captureId: fixture.captureId,
                    slot: 0,
                    observationRevision: 2,
                    nickname: null,
                    candidateNicknames: ['다라'],
                    portrait: null
                  }
                ]
              ]
            ]
          : [[controlChannel, [{ ...lookup, serverId: 'unknown-server' }]]]

      const invalidCommands: Array<[string, unknown[]]> = [
        [controlChannel, [{ action: 'end', captureId: fixture.captureId, unexpected: true }]],
        [controlChannel, [{ ...lookup, observationRevision: 0 }]],
        [controlChannel, [{ action: 'end', captureId: fixture.captureId }, null]],
        ...searchCommands
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
      response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
      await vi.waitFor(async () =>
        expect((await fixture.read()).slots[0]).toMatchObject({
          requestId: pending.slots[0].requestId,
          observationRevision: 1,
          nickname: '가나',
          state: 'success',
          rows: [candidate],
          error: null
        })
      )
    }
  )
})
