import { assign, fromCallback, fromPromise, setup, type SnapshotFrom } from 'xstate'
import {
  startPartyCaptureSession,
  type CaptureSessionInput,
  type CaptureSessionEvent
} from './party-capture-session'

import type { CapturePhase } from '../types/capture'

type CaptureInput = CaptureSessionInput & {
  selectSource: (sourceId: string) => Promise<unknown>
  endSearch: () => void
  resetRecognition: () => void
}

type CaptureContext = {
  effects: CaptureInput
  selectedSourceId: string
  registeredSourceId: string | null
  autoStart: boolean
  request: object | null
  status: string
}

type CaptureEvent =
  | { type: 'SELECT'; sourceId: string; autoStart: boolean; request: object }
  | { type: 'START'; request: object }
  | { type: 'STOP'; status?: string }
  | { type: 'NOTICE'; status: string }
  | CaptureSessionEvent

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
        return input.sourceId
      }
    ),
    captureSession: fromCallback<CaptureSessionEvent, CaptureInput>(({ input, sendBack }) =>
      startPartyCaptureSession(input, sendBack)
    ),
    lifetime: fromCallback<CaptureEvent, CaptureInput>(({ input }) => () => {
      input.endSearch()
      void input.selectSource('').catch(() => undefined)
    })
  },
  guards: {
    hasRegisteredSource: ({ context }) =>
      context.selectedSourceId.length > 0 &&
      context.selectedSourceId === context.registeredSourceId,
    shouldAutoStart: ({ context }) => context.autoStart && context.selectedSourceId.length > 0,
    hasSelectedSource: ({ context }) => context.selectedSourceId.length > 0
  },
  actions: {
    resetSearch: ({ context }) => {
      context.effects.endSearch()
      context.effects.resetRecognition()
    },
    setNotice: assign({
      status: ({ event }) => ('status' in event ? (event.status ?? '캡처를 중지했습니다.') : '')
    }),
    recordRequest: assign(({ event }) => ('request' in event ? { request: event.request } : {})),
    selectSource: assign(({ event }) => {
      if (event.type !== 'SELECT') {
        return {}
      }
      return {
        selectedSourceId: event.sourceId,
        registeredSourceId: null,
        autoStart: event.autoStart,
        request: event.request,
        status: event.sourceId
          ? '게임 창 선택을 확인하고 있습니다.'
          : '캡처할 게임 창을 선택해 주세요.'
      }
    })
  }
}).createMachine({
  id: 'partyCapture',
  initial: 'idle',
  context: ({ input }) => ({
    effects: input,
    selectedSourceId: '',
    registeredSourceId: null,
    autoStart: false,
    request: null,
    status: '캡처할 게임 창을 선택해 주세요.'
  }),
  invoke: { src: 'lifetime', input: ({ context }) => context.effects },
  on: {
    SELECT: { target: '.selecting', actions: ['resetSearch', 'selectSource'] },
    STOP: {
      target: '.idle',
      actions: [
        'resetSearch',
        assign({ status: ({ event }) => event.status ?? '캡처를 중지했습니다.' })
      ]
    },
    START: [
      {
        guard: 'hasRegisteredSource',
        target: '.capturing',
        actions: ['resetSearch', 'recordRequest']
      },
      {
        actions: assign({
          status: '게임 창 선택을 확인하고 있습니다. 잠시 후 캡처를 시작해 주세요.'
        })
      }
    ],
    NOTICE: { actions: 'setNotice' }
  },
  states: {
    idle: {},
    selecting: {
      on: {
        SELECT: { target: 'selecting', reenter: true, actions: ['resetSearch', 'selectSource'] }
      },
      tags: ['busy'],
      invoke: {
        src: 'registerSource',
        input: ({ context }) => ({ sourceId: context.selectedSourceId, effects: context.effects }),
        onDone: [
          {
            guard: 'shouldAutoStart',
            target: 'capturing',
            actions: assign({ registeredSourceId: ({ event }) => event.output })
          },
          {
            guard: 'hasSelectedSource',
            target: 'selected',
            actions: assign({
              registeredSourceId: ({ event }) => event.output,
              status: '게임 창을 선택했습니다. 캡처 시작을 눌러 주세요.'
            })
          },
          { target: 'idle' }
        ],
        onError: {
          target: 'failed',
          actions: assign({ status: '게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.' })
        }
      }
    },
    selected: {},
    capturing: {
      initial: 'search',
      entry: assign({ status: '캡처를 준비하고 있습니다.' }),
      invoke: { src: 'captureSession', input: ({ context }) => context.effects },
      on: {
        START: { target: 'capturing', reenter: true, actions: ['resetSearch', 'recordRequest'] },
        FAILED: { target: 'failed', actions: ['resetSearch', 'setNotice'] }
      },
      states: {
        search: { tags: ['busy'], on: { START: {}, MEDIA_REQUESTED: 'media' } },
        media: {
          tags: ['busy'],
          on: {
            OCR_START: {
              target: 'ocr',
              actions: assign({ status: '글자 인식을 준비하고 있습니다. 잠시 기다려 주세요.' })
            }
          }
        },
        ocr: { tags: ['busy'], on: { READY: { target: 'active', actions: 'setNotice' } } },
        active: {}
      }
    },
    failed: {}
  }
})

// 목록 조회 상태와 독립적인 캡처 수명을 UI가 사용할 단계로 변환한다.
export function getCapturePhase(snapshot: SnapshotFrom<typeof partyCaptureMachine>): CapturePhase {
  if (snapshot.matches({ capturing: 'active' })) {
    return 'active'
  }
  if (snapshot.matches('capturing')) {
    return 'starting'
  }
  if (snapshot.matches('selecting')) {
    return 'selecting'
  }
  if (snapshot.matches('selected')) {
    return 'selected'
  }
  if (snapshot.matches('failed')) {
    return 'failed'
  }
  return 'idle'
}
