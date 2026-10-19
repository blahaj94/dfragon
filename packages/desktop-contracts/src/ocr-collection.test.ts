import { expect, it } from 'vitest'
import { parseCollectOcrSample, parseOcrCollectionResult } from './ocr-collection'

const request = {
  captureId: '10000000-0000-4000-8000-000000000001',
  frameId: '10000000-0000-4000-8000-000000000002',
  slot: 1,
  prediction: null
}

it('발급 프레임 참조와 1부터4 슬롯만 허용하고 픽셀, 좌표, URL 추가 입력을 거절한다', () => {
  expect(parseCollectOcrSample([request])).toEqual(request)
  for (const invalid of [
    { ...request, sourceUrl: 'https://example.invalid' },
    { ...request, rgba: new Uint8Array() },
    { ...request, frameId: 'unbound' },
    { ...request, slot: 0 },
    { ...request, slot: 5 },
    { ...request, prediction: 'x'.repeat(129) }
  ]) {
    expect(parseCollectOcrSample([invalid])).toBeNull()
  }
  expect(parseCollectOcrSample([request, null])).toBeNull()
})

it('IPC 실패 응답의 상세 내용을 UI로 전달하지 않는다', () => {
  expect(parseOcrCollectionResult({ status: 'queued' })).toEqual({ status: 'queued' })
  expect(parseOcrCollectionResult({ status: 'failed', error: 'private detail' })).toEqual({
    status: 'failed'
  })
})
