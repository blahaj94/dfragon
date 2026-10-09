import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { requestOcr, OcrApiError } from '../client.js'
import { OCR_ERROR_CODE } from '../../src/errors.js'
import * as uploadInput from '../upload-input.js'
import { useCaptureUpload } from './use-capture-upload.js'
import { CaptureUpload } from '../CaptureUpload.js'

vi.mock('../client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client.js')>()

  return { ...actual, requestOcr: vi.fn() }
})
// 16×16 RGBA PNG 두 장. 크롭 사례는 실제 원본 픽셀 범위 안에 있다.
const firstPng =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGMQkdP4TwlmGDVg1IBRA4aLAQCPhVkQOyGaIgAAAABJRU5ErkJggg=='
const secondPng =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGNIyav4TwlmGDVg1IBRA4aLAQCkHUkfd3vA8gAAAABJRU5ErkJggg=='
function pngFile(name: string, encoded = firstPng) {
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))

  return new File([bytes], name, { type: 'image/png' })
}
let root: Root
let container: HTMLDivElement
let client: QueryClient
let upload: ReturnType<typeof useCaptureUpload>
function Harness() {
  const value = useCaptureUpload()
  useEffect(() => {
    upload = value
  }, [value])

  return null
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  vi.mocked(requestOcr).mockImplementation(async (_path, _method, body) => {
    if (typeof body !== 'object' || body === null || !('id' in body)) {
      throw new Error('업로드 요청의 캡처 ID가 없습니다')
    }

    return { id: body.id, duplicate: false }
  })
  vi.spyOn(uploadInput, 'readPngBase64')
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
  )
})

it('UI 크기 상한을 1000%로 표시하고 서버에는 배율 10을 요청한다', async () => {
  await act(async () => {
    upload.setFile(pngFile('maximum-scale.png'))
    upload.setScale('1000')
  })
  await act(async () => {
    upload.uploadNew()
    await vi.waitFor(() => expect(requestOcr).toHaveBeenCalledOnce())
  })
  expect(requestOcr).toHaveBeenLastCalledWith(
    '/api/captures',
    'POST',
    expect.objectContaining({ uiScale: 10 })
  )
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <CaptureUpload open onClose={vi.fn()} />
      </QueryClientProvider>
    )
  )
  expect(
    container.querySelector<HTMLInputElement>('input[placeholder="모르면 비워두기"]')?.max
  ).toBe('1000')
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('보관한 요청이 없으면 재시도하지 않고 실패 뒤 폼을 수정해도 최초 PNG, 좌표, 배율 본문을 유지한다', async () => {
  await act(async () => upload.retryPrevious())
  expect(requestOcr).not.toHaveBeenCalled()
  vi.mocked(requestOcr).mockRejectedValueOnce(new OcrApiError(OCR_ERROR_CODE.UNAVAILABLE))
  await act(async () => {
    upload.setFile(pngFile('fixture.png'))
    upload.setScale('75')
    upload.setSource('estimated')
    upload.setCrops([{ slot: 1, x: 2, y: 3, width: 4, height: 5 }])
  })
  await act(async () => {
    upload.uploadNew()
    await vi.waitFor(() => expect(requestOcr).toHaveBeenCalledOnce())
  })
  const body = upload.submission
  expect(body).toMatchObject({
    id: expect.any(String),
    capturedAt: expect.any(String),
    kind: 'hud',
    uiScale: 0.75,
    uiScaleSource: 'estimated',
    originalPng: firstPng,
    crops: [{ slot: 1, x: 2, y: 3, width: 4, height: 5 }]
  })
  await act(async () => {
    upload.setScale('50')
    upload.setKind('raid')
    upload.setSource('game')
    upload.setCrops([{ slot: 1, x: 9, y: 8, width: 7, height: 6 }])
  })
  await act(async () => upload.retryPrevious())
  expect(requestOcr).toHaveBeenCalledTimes(2)
  expect(vi.mocked(requestOcr).mock.calls[1][2]).toBe(body)
  expect(uploadInput.readPngBase64).toHaveBeenCalledOnce()
  expect(upload.submission).toBeNull()
})

it('파일 읽기부터 즉시 중복 요청을 잠그고 다른 PNG를 고르면 이전 재시도 본문을 비운다', async () => {
  let finish!: (value: string) => void
  vi.mocked(uploadInput.readPngBase64).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  vi.mocked(requestOcr).mockRejectedValueOnce(new OcrApiError(OCR_ERROR_CODE.UNAVAILABLE))
  await act(async () => upload.setFile(pngFile('first.png')))
  await act(async () => {
    upload.uploadNew()
    upload.uploadNew()
    upload.retryPrevious()
  })
  expect(uploadInput.readPngBase64).toHaveBeenCalledOnce()
  expect(requestOcr).not.toHaveBeenCalled()
  await act(async () => finish(firstPng))
  expect(requestOcr).toHaveBeenCalledOnce()
  await act(async () => {
    upload.setFile(pngFile('second.png', secondPng))
    upload.retryPrevious()
  })
  expect(upload.submission).toBeNull()
  expect(requestOcr).toHaveBeenCalledOnce()
})
