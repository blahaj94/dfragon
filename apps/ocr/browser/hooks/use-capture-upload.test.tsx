import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { requestOcr } from '../client.js'
import { readPngBase64 } from '../upload-input.js'
import { useCaptureUpload } from './use-capture-upload.js'

vi.mock('../client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client.js')>()

  return { ...actual, requestOcr: vi.fn() }
})
vi.mock('../upload-input.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../upload-input.js')>()

  return { ...actual, readPngBase64: vi.fn() }
})
let root: Root
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
  vi.mocked(requestOcr).mockResolvedValue(undefined)
  vi.mocked(readPngBase64).mockResolvedValue('original-png-bytes')
  root = createRoot(document.createElement('div'))
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

it('ignores retry without a submission and preserves the exact failed body after editing the form', async () => {
  await act(async () => upload.retryPrevious())
  expect(requestOcr).not.toHaveBeenCalled()
  vi.mocked(requestOcr).mockRejectedValueOnce(new Error('connection lost'))
  await act(async () => {
    upload.setFile(new File(['png'], 'fixture.png'))
    upload.setScale('75')
    upload.setSource('estimated')
    upload.setCrops([{ slot: 1, x: 2, y: 3, width: 4, height: 5 }])
  })
  await act(async () => upload.uploadNew())
  const body = upload.submission
  expect(body).toMatchObject({
    id: expect.any(String),
    capturedAt: expect.any(String),
    kind: 'hud',
    uiScale: 0.75,
    uiScaleSource: 'estimated',
    originalPng: 'original-png-bytes',
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
  expect(readPngBase64).toHaveBeenCalledOnce()
  expect(upload.submission).toBeNull()
})

it('locks preparation before React rerenders and clears retry data when selecting a new file', async () => {
  let finish!: (value: string) => void
  vi.mocked(readPngBase64).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  vi.mocked(requestOcr).mockRejectedValueOnce(new Error('offline'))
  await act(async () => upload.setFile(new File(['png'], 'first.png')))
  await act(async () => {
    upload.uploadNew()
    upload.uploadNew()
    upload.retryPrevious()
  })
  expect(readPngBase64).toHaveBeenCalledOnce()
  expect(requestOcr).not.toHaveBeenCalled()
  await act(async () => finish('first-image'))
  expect(requestOcr).toHaveBeenCalledOnce()
  await act(async () => {
    upload.setFile(new File(['other'], 'second.png'))
    upload.retryPrevious()
  })
  expect(upload.submission).toBeNull()
  expect(requestOcr).toHaveBeenCalledOnce()
})
