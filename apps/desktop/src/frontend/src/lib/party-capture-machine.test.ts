import { createActor, waitFor } from 'xstate'
import { afterEach, expect, it, vi } from 'vitest'
import { partyCaptureMachine } from './party-capture-machine'
import type { WindowFrameResult } from '../../../preload/common/types/capture'

const modules = vi.hoisted(() => ({ diagnostic: vi.fn() }))
vi.mock('./ocr', () => ({ createPartyOcrWorker: vi.fn() }))
vi.mock('./runtime-diagnostics', () => ({
  reportRendererDiagnostic: modules.diagnostic,
  showRejectedOcrNickname: vi.fn()
}))

const CAPTURE_ID = '00000000-0000-4000-8000-000000000001'

function start() {
  const effects = {
    selectSource: vi.fn(async (_sourceId: string): Promise<unknown> => undefined),
    beginSearch: vi.fn(async (_signal: AbortSignal): Promise<string | null> => CAPTURE_ID),
    endSearch: vi.fn(),
    readFrame: vi.fn(
      async (_captureId: string): Promise<WindowFrameResult> => ({
        kind: 'unsupported'
      })
    ),
    observeOcr: vi.fn()
  }
  const actor = createActor(partyCaptureMachine, { input: effects }).start()

  return { actor, effects }
}

afterEach(() => {
  vi.resetAllMocks()
})

it('시작한 회차 수는 받아들인 START마다 오르고 창 선택과 중지는 세지 않는다', async () => {
  const { actor, effects } = start()
  const pendingFrame = Promise.withResolvers<WindowFrameResult>()
  effects.readFrame.mockReturnValueOnce(pendingFrame.promise)
  const startedRounds = () => actor.getSnapshot().context.startedRounds

  actor.send({ type: 'SELECT', sourceId: 'game' })
  await waitFor(actor, (state) => state.matches('selected'))
  expect(startedRounds()).toBe(0)

  actor.send({ type: 'START' })
  expect(startedRounds()).toBe(1)

  actor.send({ type: 'START' })
  expect(startedRounds()).toBe(1)

  await waitFor(actor, (state) => state.matches({ capturing: 'frame' }))
  actor.send({ type: 'START' })
  expect(startedRounds()).toBe(2)

  await waitFor(actor, (state) => state.matches('captureFailed'))
  expect(startedRounds()).toBe(2)
  actor.send({ type: 'START' })
  expect(startedRounds()).toBe(3)

  await waitFor(actor, (state) => state.matches('captureFailed'))
  actor.send({ type: 'STOP' })
  expect(startedRounds()).toBe(3)
  actor.send({ type: 'SELECT', sourceId: 'game' })
  expect(startedRounds()).toBe(3)
})
