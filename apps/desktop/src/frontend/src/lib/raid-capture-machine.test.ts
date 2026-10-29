import { createActor, waitFor } from 'xstate'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getRaidCapturePhase, raidCaptureMachine } from './raid-capture-machine'
import { createSharedOcrWorker } from './ocr-worker-recognition'
import type { RaidFrameResult } from '../../../preload/common/types/capture'
import type { RaidSlotRecognition } from './raid-recognition'

const modules = vi.hoisted(() => ({
  worker: vi.fn(),
  recognize: vi.fn(),
  diagnostic: vi.fn(),
  rejected: vi.fn()
}))
vi.mock('./ocr', () => ({ createPartyOcrWorker: modules.worker }))
vi.mock('./raid-recognition', () => ({ recognizeRaidRows: modules.recognize }))
vi.mock('./runtime-diagnostics', () => ({
  reportRendererDiagnostic: modules.diagnostic,
  showRejectedOcrNickname: modules.rejected
}))

const ROUND = '00000000-0000-4000-8000-000000000001'
const NEXT_ROUND = '00000000-0000-4000-8000-000000000002'
const crop = { width: 86, height: 17, rgba: new Uint8Array(86 * 17 * 4) }
const rows: RaidFrameResult = {
  kind: 'rows',
  valueColumn: 'fame',
  rows: Array.from({ length: 12 }, (_, row) =>
    row < 3 ? { nickname: crop, job: crop, valueText: '12,345' } : null
  )
}
const recognized: RaidSlotRecognition[] = [
  { kind: 'recognized', nickname: '첫째', slot: 0, jobText: '眞 크루세이더' },
  { kind: 'rejected', rejection: 'too-long', text: '가'.repeat(13), slot: 1, jobText: null },
  { kind: 'recognized', nickname: '셋째', slot: 2, jobText: '眞 크루세이더' },
  ...Array.from({ length: 9 }, (_, index) => ({ kind: 'missing' as const, slot: index + 3 }))
]

function start() {
  const effects = {
    beginSearch: vi.fn(async (_signal: AbortSignal): Promise<string | null> => ROUND),
    readFrame: vi.fn(async (_captureId: string): Promise<RaidFrameResult> => rows),
    observeOcr: vi.fn(),
    recognizeWithOcr: createSharedOcrWorker().recognize
  }
  const actor = createActor(raidCaptureMachine, { input: effects }).start()

  return { actor, effects }
}

beforeEach(() => {
  modules.worker.mockResolvedValue({ recognize: vi.fn(), terminate: vi.fn() })
  modules.recognize.mockResolvedValue(recognized)
  vi.useFakeTimers({ now: new Date('2026-10-19T00:00:00Z'), toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

it('등록된 창이 없으면 START를 받지 않고 등록 뒤에만 회차를 시작한다', () => {
  const { actor, effects } = start()
  expect(actor.getSnapshot().can({ type: 'START' })).toBe(false)
  actor.send({ type: 'START' })
  expect(effects.beginSearch).not.toHaveBeenCalled()

  actor.send({ type: 'SOURCE', sourceId: 'game' })
  expect(actor.getSnapshot().can({ type: 'START' })).toBe(true)
  actor.send({ type: 'START' })
  expect(effects.beginSearch).toHaveBeenCalledOnce()
  expect(actor.getSnapshot().context.status).toBe('공대를 인식하고 있습니다.')
})

it('회차는 공대 수명을 시작해 프레임 한 장의 12행을 인식하고 인식한 슬롯만 이름으로 알린다', async () => {
  const { actor, effects } = start()
  actor.send({ type: 'SOURCE', sourceId: 'game' })
  actor.send({ type: 'START' })

  await waitFor(actor, (state) => state.matches({ capturing: 'complete' }))

  expect(effects.readFrame).toHaveBeenCalledExactlyOnceWith(ROUND)
  expect(modules.recognize).toHaveBeenCalledExactlyOnceWith(rows.rows, expect.any(Function))
  const raidRow = { jobText: '眞 크루세이더', valueColumn: 'fame', valueText: '12,345' }
  expect(effects.observeOcr.mock.calls.map(([input]) => input)).toEqual([
    { slot: 0, nickname: '첫째', candidateNicknames: ['첫째'], portrait: null, raidRow },
    {
      slot: 1,
      nickname: '',
      candidateNicknames: [''],
      portrait: null,
      raidRow: { ...raidRow, jobText: null }
    },
    { slot: 2, nickname: '셋째', candidateNicknames: ['셋째'], portrait: null, raidRow }
  ])
  expect(modules.rejected).toHaveBeenCalledOnce()
  const snapshot = actor.getSnapshot()
  expect(getRaidCapturePhase(snapshot)).toBe('complete')
  expect(snapshot.context.status).toBe('인식을 마쳤습니다. 다시 인식하려면 Alt+R을 누르세요.')
  expect(snapshot.context.completedAt).toBe(Date.now())
})

it.each([
  [
    { kind: 'missing', reason: 'not-found' },
    '공대 상세 창을 찾지 못했습니다. 12인 공대 상세 창을 연 뒤 Alt+R을 누르세요.'
  ],
  [
    { kind: 'missing', reason: 'uncertain' },
    '공대 상세 창을 확인하지 못했습니다. 창 하나만 가려지지 않게 연 뒤 Alt+R을 누르세요.'
  ],
  [
    { kind: 'waiting', reason: 'covered' },
    '게임 창이 가려져 있습니다. 게임 창을 앞으로 가져온 뒤 Alt+R을 누르세요.'
  ],
  [
    { kind: 'waiting', reason: 'unavailable' },
    '게임 화면을 읽지 못했습니다. 창이 최소화되지 않았는지 확인한 뒤 Alt+R을 누르세요.'
  ],
  [
    { kind: 'rows', valueColumn: 'unknown', rows: Array.from({ length: 12 }, () => null) },
    '공대원 이름을 찾지 못했습니다. 공대 상세 창이 가려지지 않게 한 뒤 Alt+R을 누르세요.'
  ]
] as const)('프레임 결과 %j는 확인 필요로 끝내고 다시 읽지 않는다', async (frame, status) => {
  const { actor, effects } = start()
  effects.readFrame.mockResolvedValue(frame)
  modules.recognize.mockResolvedValue(
    Array.from({ length: 12 }, (_, slot) => ({ kind: 'missing', slot }))
  )
  actor.send({ type: 'SOURCE', sourceId: 'game' })
  actor.send({ type: 'START' })

  await waitFor(actor, (state) => state.matches({ capturing: 'unavailable' }))

  expect(getRaidCapturePhase(actor.getSnapshot())).toBe('unavailable')
  expect(actor.getSnapshot().context.status).toBe(status)
  expect(effects.readFrame).toHaveBeenCalledOnce()
  expect(effects.observeOcr).not.toHaveBeenCalled()
  expect(actor.getSnapshot().context.completedAt).toBeNull()
})

it.each([
  ['수명 시작 실패', '검색을 시작하지 못했습니다. Alt+R을 눌러 다시 시도해 주세요.'],
  ['프레임 거절', '캡처 연결이 종료되었습니다. 창을 다시 선택해 주세요.'],
  ['미지원', '화면 캡처는 Windows에서 사용할 수 있습니다.'],
  ['OCR 준비 실패', '글자 인식을 준비하지 못했습니다. Alt+R을 눌러 다시 인식해 주세요.'],
  [
    '한 행 인식 실패',
    '글자 인식에 실패했습니다. Alt+R을 누르거나 서버와 이름을 직접 조회해 주세요.'
  ]
] as const)(
  '%s는 실패로 끝내고 이름을 알리지 않으며 Alt+R로 다시 시작한다',
  async (cause, status) => {
    const { actor, effects } = start()
    if (cause === '수명 시작 실패') {
      effects.beginSearch.mockResolvedValue(null)
    } else if (cause === '프레임 거절') {
      effects.readFrame.mockRejectedValue(new Error('CAPTURE_NOT_ALLOWED'))
    } else if (cause === '미지원') {
      effects.readFrame.mockResolvedValue({ kind: 'unsupported' })
    } else if (cause === 'OCR 준비 실패') {
      modules.worker.mockRejectedValue(new Error('worker'))
    } else {
      modules.recognize.mockResolvedValue([{ kind: 'failed', slot: 0 }, ...recognized.slice(1)])
    }
    actor.send({ type: 'SOURCE', sourceId: 'game' })
    actor.send({ type: 'START' })

    await waitFor(actor, (state) => state.matches('failed'))

    expect(actor.getSnapshot().context.status).toBe(status)
    expect(getRaidCapturePhase(actor.getSnapshot())).toBe('failed')
    expect(effects.observeOcr).not.toHaveBeenCalled()
    expect(modules.diagnostic).toHaveBeenCalledOnce()
    actor.send({ type: 'START' })
    expect(effects.beginSearch).toHaveBeenCalledTimes(2)
  }
)

it('수명 시작을 기다리는 동안의 START는 무시하고 인식 중 START는 이전 회차 결과를 버린다', async () => {
  const { actor, effects } = start()
  const begin = Promise.withResolvers<string | null>()
  effects.beginSearch.mockReturnValueOnce(begin.promise).mockResolvedValueOnce(NEXT_ROUND)
  const first = Promise.withResolvers<RaidSlotRecognition[]>()
  modules.recognize.mockReturnValueOnce(first.promise).mockResolvedValueOnce(recognized)
  actor.send({ type: 'SOURCE', sourceId: 'game' })
  actor.send({ type: 'START' })
  actor.send({ type: 'START' })
  expect(effects.beginSearch).toHaveBeenCalledOnce()
  begin.resolve(ROUND)
  await waitFor(actor, (state) => state.matches({ capturing: 'recognizing' }))
  const roundBefore = actor.getSnapshot().context.round

  actor.send({ type: 'START' })
  first.resolve(recognized)
  await waitFor(actor, (state) => state.matches({ capturing: 'complete' }))

  expect(effects.readFrame.mock.calls.map(([captureId]) => captureId)).toEqual([ROUND, NEXT_ROUND])
  expect(effects.observeOcr).toHaveBeenCalledTimes(3)
  expect(actor.getSnapshot().context.round).toBe(roundBefore + 1)
})

it.each([null, 'next'])(
  '진행 중 창 등록이 %s로 바뀌면 회차를 끝내고 늦은 인식 결과를 알리지 않는다',
  async (sourceId) => {
    const { actor, effects } = start()
    const pending = Promise.withResolvers<RaidSlotRecognition[]>()
    modules.recognize.mockReturnValueOnce(pending.promise)
    actor.send({ type: 'SOURCE', sourceId: 'game' })
    actor.send({ type: 'START' })
    await waitFor(actor, (state) => state.matches({ capturing: 'recognizing' }))

    actor.send({ type: 'SOURCE', sourceId })
    pending.resolve(recognized)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(actor.getSnapshot().matches('idle')).toBe(true)
    expect(actor.getSnapshot().context.status).toBe('Alt+R을 눌러 공대를 인식해 주세요.')
    expect(effects.observeOcr).not.toHaveBeenCalled()
    expect(actor.getSnapshot().can({ type: 'START' })).toBe(sourceId !== null)
  }
)

it('완료한 회차는 창 등록이 바뀌어도 결과와 완료 시각을 유지한다', async () => {
  const { actor } = start()
  actor.send({ type: 'SOURCE', sourceId: 'game' })
  actor.send({ type: 'START' })
  await waitFor(actor, (state) => state.matches({ capturing: 'complete' }))
  const completedAt = actor.getSnapshot().context.completedAt

  actor.send({ type: 'SOURCE', sourceId: null })

  expect(actor.getSnapshot().matches({ capturing: 'complete' })).toBe(true)
  expect(actor.getSnapshot().context.completedAt).toBe(completedAt)
  expect(actor.getSnapshot().can({ type: 'START' })).toBe(false)
})

it('시작한 회차 수는 받아들인 START마다 오르고 무시한 START와 취소된 회차는 영향이 없다', async () => {
  const { actor } = start()
  const pending = Promise.withResolvers<RaidSlotRecognition[]>()
  modules.recognize.mockReturnValueOnce(pending.promise)
  actor.send({ type: 'START' })
  expect(actor.getSnapshot().context.startedRounds).toBe(0)

  actor.send({ type: 'SOURCE', sourceId: 'game' })
  actor.send({ type: 'START' })
  actor.send({ type: 'START' })
  expect(actor.getSnapshot().context.startedRounds).toBe(1)
  await waitFor(actor, (state) => state.matches({ capturing: 'recognizing' }))

  actor.send({ type: 'SOURCE', sourceId: null })
  pending.resolve(recognized)
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(actor.getSnapshot().context.startedRounds).toBe(1)

  actor.send({ type: 'SOURCE', sourceId: 'game' })
  actor.send({ type: 'START' })
  expect(actor.getSnapshot().context.startedRounds).toBe(2)
})
