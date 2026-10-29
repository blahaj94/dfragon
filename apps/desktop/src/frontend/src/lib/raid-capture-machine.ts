import { assign, fromPromise, setup, type SnapshotFrom } from 'xstate'
import type { CapturePhase } from '../types/capture'
import type { RaidFrameResult, RaidFrameRow } from '../../../preload/common/types/capture'
import type { RaidValueColumn } from '../../../preload/common/types/search'
import {
  beginCaptureSearch,
  CAPTURE_COMPLETE_STATUS,
  CAPTURE_DISCONNECTED_STATUS,
  CAPTURE_UNSUPPORTED_STATUS,
  getCapturingPhase,
  getObservedNickname,
  getRecognizeErrorStatus,
  getWaitingStatus
} from './capture-round'
import type { OcrCaptureObservation } from './capture-search'
import { recognizeWithOcrWorker } from './ocr-worker-recognition'
import { recognizeRaidRows, type RaidSlotRecognition } from './raid-recognition'
import { reportRendererDiagnostic, showRejectedOcrNickname } from './runtime-diagnostics'

const READY_STATUS = 'Alt+R을 눌러 공대를 인식해 주세요.'
const OCR_FAILED_STATUS =
  '글자 인식에 실패했습니다. Alt+R을 누르거나 서버와 이름을 직접 조회해 주세요.'

type RaidCaptureInput = {
  beginSearch: (signal: AbortSignal) => Promise<string | null>
  readFrame: (captureId: string) => Promise<RaidFrameResult>
  observeOcr: (input: OcrCaptureObservation) => void
}

type RaidCaptureContext = {
  effects: RaidCaptureInput
  sourceId: string | null
  captureId: string | null
  rows: readonly (RaidFrameRow | null)[]
  valueColumn: RaidValueColumn
  results: RaidSlotRecognition[]
  round: number
  startedRounds: number
  status: string
  completedAt: number | null
}

type RaidCaptureEvent = { type: 'START' } | { type: 'SOURCE'; sourceId: string | null }

/**
 * 공대 화면의 캡처 회차. 파티 캡처처럼 Alt+R과 공대 헤더의 캡처 버튼이 같은 START를 보내고, 회차마다 공대
 * 수명을 새로 시작한 뒤 게임 창 프레임을 한 장만 읽어 12행 공대원 이름을 인식한다. 창 선택은 파티 캡처가
 * 소유하고 등록 결과를 SOURCE로 알린다. 등록된 창이 없으면 START를 받지 않고, 등록이 바뀌면 진행 중 회차를
 * 끝낸다. 그 회차가 이미 비운 슬롯은 비운 채로 두고 완료 시각도 지운다.
 */
export const raidCaptureMachine = setup({
  types: {
    context: {} as RaidCaptureContext,
    input: {} as RaidCaptureInput,
    events: {} as RaidCaptureEvent
  },
  actors: {
    beginSearch: beginCaptureSearch,
    readFrame: fromPromise(
      ({ input }: { input: { captureId: string; effects: RaidCaptureInput } }) =>
        input.effects.readFrame(input.captureId)
    ),
    recognize: fromPromise(
      ({ input, signal }: { input: readonly (RaidFrameRow | null)[]; signal: AbortSignal }) =>
        recognizeWithOcrWorker(signal, OCR_FAILED_STATUS, (recognizeText) =>
          recognizeRaidRows(input, recognizeText)
        )
    )
  },
  guards: {
    hasSource: ({ context }) => context.sourceId !== null
  },
  actions: {
    recordSource: assign({
      sourceId: ({ event }) => {
        if (event.type !== 'SOURCE') {
          return null
        }

        return event.sourceId
      }
    }),
    countStart: assign({ startedRounds: ({ context }) => context.startedRounds + 1 }),
    cancelRound: assign({ status: READY_STATUS, completedAt: null }),
    resetRecognition: assign({
      captureId: null,
      rows: [],
      valueColumn: 'unknown',
      results: [],
      round: ({ context }) => context.round + 1
    }),
    applyRecognition: ({ context }) => {
      for (const result of context.results) {
        if (result.kind === 'missing' || result.kind === 'failed') {
          continue
        }
        const { slot, jobText } = result
        const raidRow = {
          jobText,
          valueColumn: context.valueColumn,
          valueText: context.rows[slot]?.valueText ?? null
        }
        if (result.kind === 'rejected') {
          showRejectedOcrNickname(result)
        }
        const nickname = getObservedNickname(result)
        context.effects.observeOcr({
          slot,
          nickname,
          candidateNicknames: [nickname],
          portrait: null,
          raidRow
        })
      }
    }
  }
}).createMachine({
  id: 'raidCapture',
  initial: 'idle',
  context: ({ input }) => ({
    effects: input,
    sourceId: null,
    captureId: null,
    rows: [],
    valueColumn: 'unknown',
    results: [],
    round: 0,
    startedRounds: 0,
    status: READY_STATUS,
    completedAt: null
  }),
  // 등록 변경은 어느 상태에서든 기록한다. 진행 중 상태는 아래에서 회차 취소를 함께 정한다.
  on: { SOURCE: { actions: 'recordSource' } },
  states: {
    idle: {
      on: { START: { guard: 'hasSource', target: 'capturing', actions: 'countStart' } }
    },
    capturing: {
      initial: 'search',
      entry: ['resetRecognition', assign({ status: '공대를 인식하고 있습니다.' })],
      on: {
        START: { guard: 'hasSource', target: 'capturing', reenter: true, actions: 'countStart' }
      },
      states: {
        search: {
          tags: ['busy'],
          // 공대 수명의 begin 응답이 도착할 때까지 중복 시작을 막는다.
          on: {
            START: {},
            SOURCE: { target: '#raidCapture.idle', actions: ['recordSource', 'cancelRound'] }
          },
          invoke: {
            src: 'beginSearch',
            input: ({ context }) => context.effects,
            onDone: {
              target: 'frame',
              actions: assign({ captureId: ({ event }) => event.output })
            },
            onError: {
              target: '#raidCapture.failed',
              actions: [
                () => reportRendererDiagnostic('CAPTURE_START_FAILED'),
                assign({ status: '검색을 시작하지 못했습니다. Alt+R을 눌러 다시 시도해 주세요.' })
              ]
            }
          }
        },
        frame: {
          tags: ['busy'],
          on: {
            SOURCE: { target: '#raidCapture.idle', actions: ['recordSource', 'cancelRound'] }
          },
          invoke: {
            src: 'readFrame',
            // 검색 시작 actor의 성공 전이에서만 captureId가 기록된다.
            input: ({ context }) => ({ captureId: context.captureId!, effects: context.effects }),
            onDone: [
              {
                guard: ({ event }) => event.output.kind === 'rows',
                target: 'recognizing',
                actions: assign(({ event }) => {
                  if (event.output.kind !== 'rows') {
                    return {}
                  }

                  return { rows: event.output.rows, valueColumn: event.output.valueColumn }
                })
              },
              {
                guard: ({ event }) => event.output.kind === 'missing',
                target: 'unavailable',
                actions: assign({
                  status: ({ event }) => {
                    if (event.output.kind === 'missing' && event.output.reason === 'not-found') {
                      return '공대 상세 창을 찾지 못했습니다. 12인 공대 상세 창을 연 뒤 Alt+R을 누르세요.'
                    }

                    return '공대 상세 창을 확인하지 못했습니다. 창 하나만 가려지지 않게 연 뒤 Alt+R을 누르세요.'
                  }
                })
              },
              {
                guard: ({ event }) => event.output.kind === 'waiting',
                target: 'unavailable',
                actions: assign({ status: ({ event }) => getWaitingStatus(event.output) })
              },
              {
                target: '#raidCapture.failed',
                actions: [
                  () => reportRendererDiagnostic('CAPTURE_READ_FAILED'),
                  assign({ status: CAPTURE_UNSUPPORTED_STATUS })
                ]
              }
            ],
            onError: {
              target: '#raidCapture.failed',
              actions: [
                () => reportRendererDiagnostic('CAPTURE_READ_FAILED'),
                assign({ status: CAPTURE_DISCONNECTED_STATUS })
              ]
            }
          }
        },
        recognizing: {
          tags: ['busy'],
          on: {
            SOURCE: { target: '#raidCapture.idle', actions: ['recordSource', 'cancelRound'] }
          },
          invoke: {
            src: 'recognize',
            // frame 상태의 성공 전이에서 확보한 회차의 크롭만 인식한다.
            input: ({ context }) => context.rows,
            onDone: [
              {
                guard: ({ event }) => event.output.some((result) => result.kind === 'failed'),
                target: '#raidCapture.failed',
                actions: [
                  () => reportRendererDiagnostic('OCR_FAILED'),
                  assign({ status: OCR_FAILED_STATUS })
                ]
              },
              {
                guard: ({ event }) => event.output.every((result) => result.kind === 'missing'),
                target: 'unavailable',
                actions: assign({
                  status:
                    '공대원 이름을 찾지 못했습니다. 공대 상세 창이 가려지지 않게 한 뒤 Alt+R을 누르세요.'
                })
              },
              {
                target: 'complete',
                actions: [assign({ results: ({ event }) => event.output }), 'applyRecognition']
              }
            ],
            onError: {
              target: '#raidCapture.failed',
              actions: [
                () => reportRendererDiagnostic('OCR_FAILED'),
                assign({
                  status: ({ event }) => getRecognizeErrorStatus(event.error, OCR_FAILED_STATUS)
                })
              ]
            }
          }
        },
        complete: {
          entry: assign({
            status: CAPTURE_COMPLETE_STATUS,
            completedAt: () => Date.now()
          })
        },
        unavailable: {}
      }
    },
    failed: {
      on: { START: { guard: 'hasSource', target: 'capturing', actions: 'countStart' } }
    }
  }
})

export function getRaidCapturePhase(
  snapshot: SnapshotFrom<typeof raidCaptureMachine>
): Extract<CapturePhase, 'idle' | 'recognizing' | 'complete' | 'unavailable' | 'failed'> {
  if (snapshot.matches('capturing')) {
    return getCapturingPhase(snapshot)
  }

  if (snapshot.matches('failed')) {
    return 'failed'
  }

  return 'idle'
}
