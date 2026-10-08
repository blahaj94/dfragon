import { afterEach, expect, it, vi, type Mock } from 'vitest'
import { createOcrCollection, type OcrCollection } from './collection'
import { partyFrame } from './test-fixture'
import { isOcrCollectionEnabled } from './policy'
import type { sendCollectionPayload } from './http'

const CAPTURE_ID = '10000000-0000-4000-8000-000000000001'
const NEXT_CAPTURE_ID = '10000000-0000-4000-8000-000000000002'
const MISSING_FRAME_ID = '10000000-0000-4000-8000-000000000003'
const collections: OcrCollection[] = []

function fixture(): {
  collection: OcrCollection
  send: Mock<typeof sendCollectionPayload>
  onFailure: Mock<(code: 'UPLOAD_FAILED' | 'UPLOAD_QUEUE_FULL') => void>
} {
  const send = vi.fn<typeof sendCollectionPayload>(async () => true)
  const onFailure = vi.fn()
  const collection = createOcrCollection({ enabled: true, send, onFailure })
  collections.push(collection)

  return { collection, send, onFailure }
}

afterEach(() => {
  collections.splice(0).forEach((collection) => collection.dispose())
  vi.useRealTimers()
})

it('검색 회차당 슬롯별 한 번만 수집하고 새 회차에는 같은 슬롯을 다시 허용한다', async () => {
  const { collection, send } = fixture()
  const frameId = collection.retain(CAPTURE_ID, partyFrame())!
  const input = { captureId: CAPTURE_ID, frameId, slot: 1 as const, prediction: null }
  expect(collection.collect(input)).toEqual({ status: 'queued' })
  expect(collection.collect(input)).toEqual({ status: 'duplicate' })
  expect(collection.collect({ ...input, slot: 2 })).toEqual({ status: 'queued' })
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  const [request] = send.mock.calls[0]
  expect(JSON.parse(request.body).crops.map(({ slot }: { slot: number }) => slot)).toEqual([1, 2])

  const nextFrameId = collection.retain(NEXT_CAPTURE_ID, partyFrame())!
  expect(collection.collect(input)).toEqual({ status: 'skipped' })
  expect(
    collection.collect({ ...input, captureId: NEXT_CAPTURE_ID, frameId: nextFrameId })
  ).toEqual({ status: 'queued' })
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
})

it('외부 프레임 참조, 보존 범위를 벗어난 프레임과 만료된 프레임은 업로드하지 않는다', () => {
  vi.useFakeTimers()
  const { collection, send } = fixture()
  const image = partyFrame()
  const oldest = collection.retain(CAPTURE_ID, image)!
  collection.retain(CAPTURE_ID, image)
  const latest = collection.retain(CAPTURE_ID, image)!
  const input = {
    captureId: CAPTURE_ID,
    frameId: MISSING_FRAME_ID,
    slot: 1 as const,
    prediction: null
  }
  expect(collection.collect(input).status).toBe('skipped')
  expect(collection.collect({ ...input, frameId: oldest }).status).toBe('skipped')
  vi.advanceTimersByTime(60_000)
  expect(collection.collect({ ...input, frameId: latest }).status).toBe('skipped')
  expect(send).not.toHaveBeenCalled()
})

it('업로드 실패가 다음 슬롯 수집을 막지 않고 정제된 진단만 남긴다', async () => {
  const { collection, send, onFailure } = fixture()
  send.mockResolvedValueOnce(false)
  const frameId = collection.retain(CAPTURE_ID, partyFrame())!
  expect(
    collection.collect({ captureId: CAPTURE_ID, frameId, slot: 1, prediction: null }).status
  ).toBe('queued')
  await vi.waitFor(() => expect(onFailure).toHaveBeenCalledWith('UPLOAD_FAILED'))
  expect(
    collection.collect({ captureId: CAPTURE_ID, frameId, slot: 2, prediction: '예측' }).status
  ).toBe('queued')
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
})

it('캡처 종료는 진행 요청을 취소하고 대기열과 프레임을 해제한다', async () => {
  let resolveUpload: (value: boolean) => void = () => undefined
  const send = vi.fn<typeof sendCollectionPayload>(
    async () =>
      new Promise<boolean>((resolve) => {
        resolveUpload = resolve
      })
  )
  const collection = createOcrCollection({ enabled: true, send })
  collections.push(collection)
  const frameId = collection.retain(CAPTURE_ID, partyFrame())!
  const input = { captureId: CAPTURE_ID, frameId, slot: 1 as const, prediction: null }
  collection.collect(input)
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  collection.collect({ ...input, slot: 2 })
  collection.clear()
  expect(send.mock.calls[0][0].signal.aborted).toBe(true)
  expect(collection.collect(input).status).toBe('skipped')
  resolveUpload(false)
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(send).toHaveBeenCalledTimes(1)
})

it('느린 전송 중 대기 프레임 상한을 넘으면 표본을 버리고 검색 호출은 즉시 반환한다', async () => {
  let finish: (value: boolean) => void = () => undefined
  const send = vi.fn<typeof sendCollectionPayload>(
    async () =>
      new Promise<boolean>((resolve) => {
        finish = resolve
      })
  )
  const onFailure = vi.fn()
  const collection = createOcrCollection({ enabled: true, send, onFailure })
  collections.push(collection)
  const firstFrame = collection.retain(CAPTURE_ID, partyFrame())!
  collection.collect({ captureId: CAPTURE_ID, frameId: firstFrame, slot: 1, prediction: null })
  await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
  for (const slot of [2, 3] as const) {
    const frameId = collection.retain(CAPTURE_ID, partyFrame())!
    expect(
      collection.collect({ captureId: CAPTURE_ID, frameId, slot, prediction: null }).status
    ).toBe('queued')
  }
  const frameId = collection.retain(CAPTURE_ID, partyFrame())!
  expect(
    collection.collect({ captureId: CAPTURE_ID, frameId, slot: 4, prediction: null }).status
  ).toBe('skipped')
  expect(onFailure).toHaveBeenCalledExactlyOnceWith('UPLOAD_QUEUE_FULL')
  collection.clear()
  finish(false)
})

it('수동 단축키는 검출한 네 슬롯과 원본을 전송하며 자동 슬롯 중복 상태를 소비하지 않는다', async () => {
  const { collection, send } = fixture()
  const image = partyFrame()
  expect(collection.collectShortcut(CAPTURE_ID, image).status).toBe('queued')
  expect(collection.collectShortcut(CAPTURE_ID, image).status).toBe('skipped')
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  const [request] = send.mock.calls[0]
  expect(JSON.parse(request.body).testCollection).toMatchObject({
    trigger: 'shortcut',
    slots: [
      { slot: 1, prediction: null },
      { slot: 2, prediction: null },
      { slot: 3, prediction: null },
      { slot: 4, prediction: null }
    ]
  })
  const frameId = collection.retain(CAPTURE_ID, image)!
  expect(
    collection.collect({ captureId: CAPTURE_ID, frameId, slot: 1, prediction: null }).status
  ).toBe('queued')
})

it('개발과 alpha 빌드만 자동 수집을 켜고 stable에서는 프레임도 보존하지 않는다', () => {
  expect(isOcrCollectionEnabled({ isPackaged: false, version: '1.0.0' })).toBe(true)
  expect(isOcrCollectionEnabled({ isPackaged: true, version: '0.0.4-alpha.1' })).toBe(true)
  expect(isOcrCollectionEnabled({ isPackaged: true, version: '0.0.4' })).toBe(false)
  expect(isOcrCollectionEnabled({ isPackaged: true, version: '0.0.4-beta.1' })).toBe(false)
  const collection = createOcrCollection({ enabled: false })
  collections.push(collection)
  expect(collection.retain(CAPTURE_ID, partyFrame())).toBeUndefined()
  expect(collection.collectShortcut(CAPTURE_ID, partyFrame()).status).toBe('skipped')
})
