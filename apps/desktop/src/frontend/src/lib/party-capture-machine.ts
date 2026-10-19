import { assign, fromCallback, fromPromise, setup, type SnapshotFrom } from 'xstate'
import type { CapturePhase, PartyOcrWorker } from '../types/capture'
import type { WindowFrameResult } from '../../../preload/common/types/capture'
import type { CharacterImage } from '../../../preload/common/types/character'
import type { OcrCaptureObservation } from './capture-search'
import { createPartyOcrWorker } from './ocr'
import { recognizePartyFrame, type PartySlotRecognition } from './party-recognition'
import { reportRendererDiagnostic, showRejectedOcrNickname } from './runtime-diagnostics'

const PARTY_SAMPLE_SLOTS = [1, 2, 3, 4] as const
const OCR_FAILED_STATUS =
  '글자 인식에 실패했습니다. Alt+R을 누르거나 캐릭터 직접 검색을 사용해 주세요.'

type RoundFrame = CharacterImage & { captureId: string; frameId?: string }
type CaptureInput = {
  selectSource: (sourceId: string) => Promise<unknown>
  beginSearch: (signal: AbortSignal) => Promise<string | null>
  endSearch: () => void
  readFrame: (captureId: string) => Promise<WindowFrameResult>
  observe: (input: { slot: number; nickname: string | null }) => void
  observeOcr?: (input: OcrCaptureObservation) => void
}

type CaptureContext = {
  effects: CaptureInput
  selectedSourceId: string
  request: object | null
  captureId: string | null
  frame: RoundFrame | null
  results: PartySlotRecognition[]
  round: number
  /** START를 받아 회차를 시작한 횟수. 실패하거나 취소된 회차도 센다. 창 선택과 중지는 세지 않는다. */
  startedRounds: number
  status: string
  /** 마지막으로 인식을 마친 회차의 완료 시각(ms). 창을 바꾸거나 중지하면 비운다. */
  completedAt: number | null
}

type CaptureEvent =
  | { type: 'SELECT'; sourceId: string }
  | { type: 'START'; request: object }
  | { type: 'STOP'; status?: string }

/** 회차 결과 반영 중 수집 실패가 검색 통지를 막지 않도록 별도로 처리한다. */
async function collectSample(frame: RoundFrame, result: PartySlotRecognition): Promise<void> {
  if (result.kind === 'missing' || frame.frameId === undefined) {
    return
  }
  try {
    const response = await window.ocrCollection.collectOcrSample({
      captureId: frame.captureId,
      frameId: frame.frameId,
      slot: PARTY_SAMPLE_SLOTS[result.slot],
      prediction: result.prediction
    })
    if (response.status === 'failed') {
      reportRendererDiagnostic('UPLOAD_FAILED')
    }
  } catch {
    reportRendererDiagnostic('UPLOAD_FAILED')
  }
}

export const partyCaptureMachine = setup({
  types: {
    context: {} as CaptureContext,
    input: {} as CaptureInput,
    events: {} as CaptureEvent
  },
  actors: {
    registerSource: fromPromise(
      async ({ input }: { input: { sourceId: string; effects: CaptureInput } }) => {
        await input.effects.selectSource(input.sourceId)
      }
    ),
    beginSearch: fromPromise(
      async ({ input, signal }: { input: CaptureInput; signal: AbortSignal }) => {
        const captureId = await input.beginSearch(signal)
        signal.throwIfAborted()
        if (captureId === null) {
          throw new Error('Search lifetime unavailable.')
        }

        return captureId
      }
    ),
    readFrame: fromPromise(({ input }: { input: { captureId: string; effects: CaptureInput } }) =>
      input.effects.readFrame(input.captureId)
    ),
    recognize: fromPromise(
      async ({ input, signal }: { input: RoundFrame; signal: AbortSignal }) => {
        let worker: PartyOcrWorker | null = null
        let status = '글자 인식을 준비하지 못했습니다. Alt+R을 눌러 다시 인식해 주세요.'
        try {
          try {
            worker = await createPartyOcrWorker(signal)
            signal.throwIfAborted()
            status = OCR_FAILED_STATUS
            const results = await recognizePartyFrame(input, worker.recognize)
            signal.throwIfAborted()

            return results
          } finally {
            await worker?.terminate()
          }
        } catch {
          throw new Error(status)
        }
      }
    ),
    lifetime: fromCallback<CaptureEvent, CaptureInput>(({ input }) => () => {
      input.endSearch()
      void input.selectSource('').catch(() => undefined)
    })
  },
  actions: {
    resetSearch: ({ context }) => context.effects.endSearch(),
    // 새 회차는 이전 완료 시각을 남겨 두고, 창 변경과 중지만 카드와 함께 완료 시각을 비운다.
    clearCompletion: assign({ completedAt: null }),
    resetRecognition: assign({
      captureId: null,
      frame: null,
      results: [],
      round: ({ context }) => context.round + 1
    }),
    countStart: assign({ startedRounds: ({ context }) => context.startedRounds + 1 }),
    recordRequest: assign(({ event }) => {
      if (event.type === 'START') {
        return { request: event.request }
      }

      return {}
    }),
    selectSource: assign(({ event }) => {
      if (event.type !== 'SELECT') {
        return {}
      }
      const status = event.sourceId
        ? '게임 창 선택을 확인하고 있습니다.'
        : '캡처할 게임 창을 선택해 주세요.'

      return { selectedSourceId: event.sourceId, request: null, status }
    }),
    applyRecognition: ({ context }) => {
      const { effects, frame, results } = context
      if (frame === null) {
        return
      }
      for (const result of results) {
        if (result.kind === 'missing' || result.kind === 'failed') {
          continue
        }
        const { slot, portrait } = result
        if (effects.observeOcr !== undefined) {
          if (result.kind === 'rejected') {
            showRejectedOcrNickname(result)
            effects.observeOcr({ slot, nickname: '', candidateNicknames: [''], portrait })
          } else {
            const { nickname } = result
            effects.observeOcr({ slot, nickname, candidateNicknames: [nickname], portrait })
          }
        } else if (result.legacyNickname.length > 0) {
          effects.observe({ slot, nickname: result.legacyNickname })
        }
      }
    },
    collectRecognition: ({ context }) => {
      if (context.frame === null) {
        return
      }
      for (const result of context.results) {
        void collectSample(context.frame, result)
      }
    }
  }
}).createMachine({
  id: 'partyCapture',
  initial: 'idle',
  context: ({ input }) => ({
    effects: input,
    selectedSourceId: '',
    request: null,
    captureId: null,
    frame: null,
    results: [],
    round: 0,
    startedRounds: 0,
    status: '캡처할 게임 창을 선택해 주세요.',
    completedAt: null
  }),
  invoke: { src: 'lifetime', input: ({ context }) => context.effects },
  // START를 선언한 상태만 Alt+R을 받는다. 중지 뒤에는 창을 다시 선택해야 한다.
  on: {
    SELECT: {
      target: '.selecting',
      actions: ['resetSearch', 'resetRecognition', 'clearCompletion', 'selectSource']
    },
    STOP: {
      target: '.stopped',
      actions: [
        'resetSearch',
        'resetRecognition',
        'clearCompletion',
        assign({
          status: ({ event }) => {
            const status = event.status ?? '캡처를 중지했습니다.'

            return status
          }
        })
      ]
    }
  },
  states: {
    idle: {},
    selecting: {
      on: {
        SELECT: {
          target: 'selecting',
          reenter: true,
          actions: ['resetSearch', 'resetRecognition', 'clearCompletion', 'selectSource']
        }
      },
      invoke: {
        src: 'registerSource',
        input: ({ context }) => ({ sourceId: context.selectedSourceId, effects: context.effects }),
        onDone: [
          {
            guard: ({ context }) => context.selectedSourceId.length > 0,
            target: 'selected',
            actions: assign({ status: 'Alt+R을 눌러 파티를 인식해 주세요.' })
          },
          { target: 'idle' }
        ],
        onError: {
          target: 'selectionFailed',
          actions: assign({ status: '게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.' })
        }
      }
    },
    selected: {
      on: { START: { target: 'capturing', actions: ['countStart', 'recordRequest'] } }
    },
    stopped: {},
    capturing: {
      initial: 'search',
      entry: ['resetSearch', 'resetRecognition', assign({ status: '파티를 인식하고 있습니다.' })],
      on: {
        START: { target: 'capturing', reenter: true, actions: ['countStart', 'recordRequest'] }
      },
      states: {
        search: {
          tags: ['busy'],
          // Main에 수명이 생긴 뒤 begin 응답이 도착할 때까지 중복 시작을 막는다.
          on: { START: {} },
          invoke: {
            src: 'beginSearch',
            input: ({ context }) => context.effects,
            onDone: {
              target: 'frame',
              actions: assign({ captureId: ({ event }) => event.output })
            },
            onError: {
              target: '#partyCapture.captureFailed',
              actions: [
                () => reportRendererDiagnostic('CAPTURE_START_FAILED'),
                assign({ status: '검색을 시작하지 못했습니다. 창을 다시 선택해 주세요.' })
              ]
            }
          }
        },
        frame: {
          tags: ['busy'],
          invoke: {
            src: 'readFrame',
            // 검색 시작 actor의 성공 전이에서만 captureId가 기록된다.
            input: ({ context }) => ({ captureId: context.captureId!, effects: context.effects }),
            onDone: [
              {
                guard: ({ event }) => event.output.kind === 'frame',
                target: 'recognizing',
                actions: assign({
                  frame: ({ context, event }) => {
                    if (event.output.kind !== 'frame') {
                      return null
                    }

                    return {
                      ...event.output.image,
                      captureId: context.captureId!,
                      frameId: event.output.frameId
                    }
                  }
                })
              },
              {
                guard: ({ event }) => event.output.kind === 'waiting',
                target: 'unavailable',
                actions: assign({
                  status: ({ event }) => {
                    if (event.output.kind === 'waiting' && event.output.reason === 'covered') {
                      return '게임 창이 가려져 있습니다. 게임 창을 앞으로 가져온 뒤 Alt+R을 누르세요.'
                    }

                    return '게임 화면을 읽지 못했습니다. 창이 최소화되지 않았는지 확인한 뒤 Alt+R을 누르세요.'
                  }
                })
              },
              {
                target: '#partyCapture.captureFailed',
                actions: [
                  () => reportRendererDiagnostic('CAPTURE_READ_FAILED'),
                  assign({ status: '화면 캡처는 Windows에서 사용할 수 있습니다.' })
                ]
              }
            ],
            onError: {
              target: '#partyCapture.captureFailed',
              actions: [
                () => reportRendererDiagnostic('CAPTURE_READ_FAILED'),
                assign({ status: '캡처 연결이 종료되었습니다. 창을 다시 선택해 주세요.' })
              ]
            }
          }
        },
        recognizing: {
          tags: ['busy'],
          invoke: {
            src: 'recognize',
            // frame 상태의 성공 전이에서 확보한 회차 프레임만 인식한다.
            input: ({ context }) => context.frame!,
            onDone: [
              {
                guard: ({ event }) => event.output.some((result) => result.kind === 'failed'),
                target: '#partyCapture.captureFailed',
                actions: [
                  assign({ results: ({ event }) => event.output }),
                  // captureFailed의 END가 원본을 지우기 전에 검출 슬롯 수집을 요청한다.
                  'collectRecognition',
                  () => reportRendererDiagnostic('OCR_FAILED'),
                  assign({ status: OCR_FAILED_STATUS })
                ]
              },
              {
                guard: ({ event }) => event.output.every((result) => result.kind === 'missing'),
                target: 'unavailable',
                actions: assign({
                  status:
                    '파티 프레임을 찾지 못했습니다. 파티 프레임이 보이게 한 뒤 Alt+R을 누르세요.'
                })
              },
              {
                target: 'complete',
                actions: [
                  assign({ results: ({ event }) => event.output }),
                  'applyRecognition',
                  'collectRecognition'
                ]
              }
            ],
            onError: {
              target: '#partyCapture.captureFailed',
              actions: [
                () => reportRendererDiagnostic('OCR_FAILED'),
                assign({
                  status: ({ event }) => {
                    if (event.error instanceof Error) {
                      return event.error.message
                    }

                    return OCR_FAILED_STATUS
                  }
                })
              ]
            }
          }
        },
        complete: {
          entry: assign({
            status: '인식을 마쳤습니다. 다시 인식하려면 Alt+R을 누르세요.',
            completedAt: () => Date.now()
          })
        },
        unavailable: {}
      }
    },
    selectionFailed: {},
    captureFailed: {
      entry: ['resetSearch', 'resetRecognition'],
      on: { START: { target: 'capturing', actions: ['countStart', 'recordRequest'] } }
    }
  }
})

/** 검색 수명은 유지하면서 회차 진행과 완료를 UI 단계로 구분한다. */
export function getCapturePhase(snapshot: SnapshotFrom<typeof partyCaptureMachine>): CapturePhase {
  if (snapshot.matches({ capturing: 'complete' })) {
    return 'complete'
  }

  if (snapshot.matches({ capturing: 'unavailable' })) {
    return 'unavailable'
  }

  if (snapshot.matches('capturing')) {
    return 'recognizing'
  }

  if (snapshot.matches('selecting')) {
    return 'selecting'
  }

  if (snapshot.matches('selected')) {
    return 'selected'
  }

  if (snapshot.matches('selectionFailed') || snapshot.matches('captureFailed')) {
    return 'failed'
  }

  return 'idle'
}
