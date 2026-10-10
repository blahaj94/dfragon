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
  autoStart: boolean
  request: object | null
  status: string
}

type CaptureEvent =
  | { type: 'SELECT'; sourceId: string; autoStart: boolean; request: object }
  | { type: 'START'; request: object }
  | { type: 'STOP'; status?: string }
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
    shouldAutoStart: ({ context }) => context.autoStart && context.selectedSourceId.length > 0,
    hasSelectedSource: ({ context }) => context.selectedSourceId.length > 0
  },
  actions: {
    resetSearch: ({ context }) => {
      context.effects.endSearch()
      context.effects.resetRecognition()
    },
    setNotice: assign({
      status: ({ event }) => {
        if (!('status' in event)) {
          return ''
        }
        const status = event.status
        if (status == null) {
          return '캡처를 중지했습니다.'
        }

        return status
      }
    }),
    recordRequest: assign(({ event }) => {
      if ('request' in event) {
        return { request: event.request }
      }

      return {}
    }),
    selectSource: assign(({ event }) => {
      if (event.type !== 'SELECT') {
        return {}
      }
      const selectedSourceId = event.sourceId
      const autoStart = event.autoStart
      const request = event.request
      const status = event.sourceId
        ? '게임 창 선택을 확인하고 있습니다.'
        : '캡처할 게임 창을 선택해 주세요.'

      return {
        selectedSourceId,
        autoStart,
        request,
        status
      }
    })
  }
}).createMachine({
  id: 'partyCapture',
  initial: 'idle',
  context: ({ input }) => ({
    effects: input,
    selectedSourceId: '',
    autoStart: false,
    request: null,
    status: '캡처할 게임 창을 선택해 주세요.'
  }),
  invoke: { src: 'lifetime', input: ({ context }) => context.effects },
  // START는 전이를 선언한 상태에서만 받으며, 그 밖의 상태에서는 Alt+R을 눌러도 캡처를 시작하지 않는다.
  on: {
    SELECT: { target: '.selecting', actions: ['resetSearch', 'selectSource'] },
    STOP: {
      target: '.stopped',
      actions: [
        'resetSearch',
        assign({
          status: ({ event }) => {
            const status = event.status
            if (status == null) {
              return '캡처를 중지했습니다.'
            }

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
        SELECT: { target: 'selecting', reenter: true, actions: ['resetSearch', 'selectSource'] }
      },
      tags: ['busy'],
      invoke: {
        src: 'registerSource',
        input: ({ context }) => ({ sourceId: context.selectedSourceId, effects: context.effects }),
        onDone: [
          { guard: 'shouldAutoStart', target: 'capturing' },
          {
            guard: 'hasSelectedSource',
            target: 'selected',
            actions: assign({ status: '게임 창을 선택했습니다. 캡처 시작을 눌러 주세요.' })
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
      on: { START: { target: 'capturing', actions: ['resetSearch', 'recordRequest'] } }
    },
    // 중지한 뒤에는 창을 다시 선택해야 캡처를 시작한다.
    stopped: {},
    capturing: {
      initial: 'search',
      entry: assign({ status: '캡처를 준비하고 있습니다.' }),
      invoke: { src: 'captureSession', input: ({ context }) => context.effects },
      on: {
        START: { target: 'capturing', reenter: true, actions: ['resetSearch', 'recordRequest'] },
        FAILED: { target: 'captureFailed', actions: ['resetSearch', 'setNotice'] }
      },
      states: {
        search: { tags: ['busy'], on: { START: {}, FRAME_REQUESTED: 'frame' } },
        frame: {
          tags: ['busy'],
          on: {
            OCR_START: {
              target: 'ocr',
              actions: assign({ status: '글자 인식을 준비하고 있습니다. 잠시 기다려 주세요.' })
            }
          }
        },
        ocr: { tags: ['busy'], on: { READY: { target: 'active', actions: 'setNotice' } } },
        active: { on: { READY: { actions: 'setNotice' } } }
      }
    },
    selectionFailed: {},
    // 캡처 실패는 확인을 마친 창 선택을 유지하므로 창을 다시 고르지 않고 재시작할 수 있다.
    captureFailed: {
      on: { START: { target: 'capturing', actions: ['resetSearch', 'recordRequest'] } }
    }
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

  if (snapshot.matches('selectionFailed') || snapshot.matches('captureFailed')) {
    return 'failed'
  }

  return 'idle'
}
