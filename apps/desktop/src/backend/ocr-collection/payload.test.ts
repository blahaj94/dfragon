import { expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { createCollectionPayload, detectCollectionCrops, type CollectionJob } from './payload'
import { partyFrame } from './test-fixture'

const CAPTURE_ID = '10000000-0000-4000-8000-000000000001'

it('원본 픽셀과 닉네임 crop을 보존하고 얼굴을 포함한 슬롯 문맥과 미검토 예측을 추가한다', async () => {
  const image = partyFrame()
  const job: CollectionJob = {
    frame: { id: CAPTURE_ID, capturedAt: '2026-10-08T00:00:00.000Z', image },
    trigger: 'ocr',
    predictions: new Map([
      [1, '☆테스트☆'],
      [3, null]
    ])
  }
  const body = await createCollectionPayload(job, CAPTURE_ID)
  expect(body).not.toBeNull()
  const payload = JSON.parse(body!)
  expect(payload.crops).toEqual([
    { slot: 1, x: 42, y: 10, width: 73, height: 16 },
    { slot: 3, x: 324, y: 10, width: 73, height: 16 }
  ])
  expect(payload.testCollection).toEqual({
    trigger: 'ocr',
    slots: [
      { slot: 1, x: 10, y: 0, width: 132, height: 43, prediction: '☆테스트☆' },
      { slot: 3, x: 292, y: 0, width: 132, height: 43, prediction: null }
    ]
  })
  const original = PNG.sync.read(Buffer.from(payload.originalPng, 'base64'))
  expect(original.width).toBe(image.width)
  expect(original.height).toBe(image.height)
  expect(original.data.equals(Buffer.from(image.rgba))).toBe(true)
  expect(payload).not.toHaveProperty('label')
})

it('닉네임 바가 보여도 얼굴이 다른 창에 가려지면 해당 슬롯은 업로드하지 않는다', () => {
  const image = partyFrame()
  image.rgba[(20 * image.width + 22) * 4 + 3] = 0
  const geometry = detectCollectionCrops(image)
  expect(geometry?.slots.map(({ nickname }) => nickname.slot)).toEqual([2, 3, 4])
})

it('검출되지 않은 슬롯과 자료실 원본 크기 제한을 초과한 프레임은 전송하지 않는다', async () => {
  const image = partyFrame()
  image.rgba.fill(0)
  expect(detectCollectionCrops(image)).toEqual(null)
  expect(detectCollectionCrops({ width: 8192, height: 8192, rgba: new Uint8Array() })).toBeNull()
})
