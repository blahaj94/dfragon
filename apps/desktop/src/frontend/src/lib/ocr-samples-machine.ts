import { assign, fromPromise, setup } from 'xstate'
import type { DeveloperApi, DeveloperSample } from '../../../preload/common/types/developer'
import { DEVELOPER_ERROR_CODES } from '../../../preload/common/developer-errors'

type OcrSamplesApi = Pick<DeveloperApi, 'listOcrSamples' | 'closeOcrSamples'>
const loginMessage = '앱에서 자료실 소유자 계정으로 로그인한 뒤 다시 불러오세요.'

/** Maps sanitized IPC failures to dataset recovery guidance. */
function errorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : ''
  return message.includes(DEVELOPER_ERROR_CODES.OCR_LOGIN_REQUIRED)
    ? loginMessage
    : message.includes(DEVELOPER_ERROR_CODES.OCR_OWNER_REQUIRED)
      ? 'OCR 자료실 소유자 계정만 조회할 수 있습니다.'
      : 'OCR 자료실을 불러오지 못했습니다. 연결과 서버 버전을 확인하고 다시 불러오세요.'
}

export const ocrSamplesMachine = setup({
  types: {
    context: {} as {
      api: OcrSamplesApi
      samples: DeveloperSample[]
      error: string
      revision: number
    },
    input: {} as { api: OcrSamplesApi },
    events: {} as { type: 'OPEN' | 'CLOSE' | 'REFRESH' | 'SIGNED_OUT' }
  },
  actors: {
    load: fromPromise<DeveloperSample[], OcrSamplesApi>(({ input }) => input.listOcrSamples())
  },
  actions: {
    clear: assign(({ context }) => ({ samples: [], error: '', revision: context.revision + 1 })),
    close: ({ context }) => {
      void context.api.closeOcrSamples().catch(() => undefined)
    }
  }
}).createMachine({
  id: 'ocrSamples',
  initial: 'closed',
  context: ({ input }) => ({ api: input.api, samples: [], error: '', revision: 0 }),
  states: {
    closed: { on: { OPEN: 'open' } },
    open: {
      initial: 'loading',
      exit: ['close', 'clear'],
      on: {
        CLOSE: 'closed',
        SIGNED_OUT: {
          target: '.failed',
          actions: ['close', 'clear', assign({ error: loginMessage })]
        }
      },
      states: {
        loading: {
          entry: 'clear',
          invoke: {
            src: 'load',
            input: ({ context }) => context.api,
            onDone: { target: 'ready', actions: assign({ samples: ({ event }) => event.output }) },
            onError: {
              target: 'failed',
              actions: assign({ error: ({ event }) => errorMessage(event.error) })
            }
          }
        },
        ready: { on: { REFRESH: 'loading' } },
        failed: { on: { REFRESH: 'loading' } }
      }
    }
  }
})
