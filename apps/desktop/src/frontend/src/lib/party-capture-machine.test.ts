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
    observe: vi.fn()
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

  // selected에서 받은 START
  actor.send({ type: 'START', request: {} })
  expect(startedRounds()).toBe(1)

  // 수명 시작을 기다리는 동안의 중복 START는 세지 않는다.
  actor.send({ type: 'START', request: {} })
  expect(startedRounds()).toBe(1)

  // 회차 진행 중 재진입한 START. 늦은 첫 프레임은 새 회차가 대신한다.
  await waitFor(actor, (state) => state.matches({ capturing: 'frame' }))
  actor.send({ type: 'START', request: {} })
  expect(startedRounds()).toBe(2)

  // 프레임을 읽지 못해 실패한 회차도 한 회차로 세었고, 실패 뒤 START도 하나 오른다.
  await waitFor(actor, (state) => state.matches('captureFailed'))
  expect(startedRounds()).toBe(2)
  actor.send({ type: 'START', request: {} })
  expect(startedRounds()).toBe(3)

  await waitFor(actor, (state) => state.matches('captureFailed'))
  actor.send({ type: 'STOP' })
  expect(startedRounds()).toBe(3)
  actor.send({ type: 'SELECT', sourceId: 'game' })
  expect(startedRounds()).toBe(3)
})
