import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  run: vi.fn(),
  tensor: vi.fn(),
  dispose: vi.fn(),
  env: { logLevel: '', wasm: { numThreads: 0, proxy: true, wasmPaths: '' } }
}))
vi.mock('onnxruntime-web/wasm', () => ({
  env: mocks.env,
  InferenceSession: { create: mocks.create },
  Tensor: class {
    dispose = mocks.dispose
    constructor(...args: unknown[]) {
      mocks.tensor(...args)
    }
  }
}))

const canvasContext = {
  putImageData: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(),
  imageSmoothingEnabled: false,
  imageSmoothingQuality: 'high'
}
const postMessage = vi.fn()
const outputDispose = vi.fn()
const pixels = { width: 2, height: 1 } as ImageData

async function send(data: { root?: string; pixels?: ImageData }): Promise<void> {
  const receive: ((event: MessageEvent) => unknown) | null = globalThis.onmessage
  await receive?.(new MessageEvent('message', { data }))
}

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('onmessage', null)
  vi.stubGlobal('postMessage', postMessage)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('가\r\n나\r\n'))
  )
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext(): typeof canvasContext {
        return canvasContext
      }
    }
  )
  canvasContext.getImageData.mockReturnValue({ data: new Uint8ClampedArray(96 * 48 * 4) })
  mocks.create.mockResolvedValue({ inputNames: ['input'], outputNames: ['output'], run: mocks.run })
  mocks.run.mockResolvedValue({
    output: { dims: [1, 1, 4], data: new Float32Array([0, 1, 0, 0]), dispose: outputDispose }
  })
  await import('./paddle.worker')
})

afterEach(() => vi.unstubAllGlobals())

it('preserves WASM setup, dictionary normalization and recognition tensor layout', async () => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  expect(mocks.env).toEqual({
    logLevel: 'error',
    wasm: { numThreads: 1, proxy: false, wasmPaths: 'https://fixture.invalid/ocr/ort/' }
  })
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
    'https://fixture.invalid/ocr/korean-rec.onnx',
    { executionProviders: ['wasm'], logSeverityLevel: 3 }
  )
  expect(postMessage).toHaveBeenLastCalledWith({ ready: true })

  await send({ pixels })
  expect(mocks.tensor).toHaveBeenCalledWith('float32', expect.any(Float32Array), [1, 3, 48, 320])
  expect(canvasContext.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 96, 48)
  expect(canvasContext.imageSmoothingEnabled).toBe(true)
  expect(canvasContext.imageSmoothingQuality).toBe('low')
  expect(postMessage).toHaveBeenLastCalledWith({ text: '가', confidence: 100 })
  expect(mocks.dispose).toHaveBeenCalledOnce()
  expect(outputDispose).toHaveBeenCalledOnce()
})

it.each([
  { sourceWidth: 2, sourceHeight: 1, resizedWidth: 96 },
  { sourceWidth: 320, sourceHeight: 48, resizedWidth: 320 },
  { sourceWidth: 400, sourceHeight: 20, resizedWidth: 320 },
  { sourceWidth: 8192, sourceHeight: 1, resizedWidth: 320 }
])(
  '$sourceWidth×$sourceHeight 이미지를 자르지 않고 48×320 텐서에 맞춘다',
  async ({ sourceWidth, sourceHeight, resizedWidth }) => {
    await send({ root: 'https://fixture.invalid/ocr/' })
    const data = new Uint8ClampedArray(resizedWidth * 48 * 4).fill(255)
    canvasContext.getImageData.mockReturnValueOnce({ data })
    await send({ pixels: { width: sourceWidth, height: sourceHeight } as ImageData })

    expect(canvasContext.drawImage).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      0,
      0,
      resizedWidth,
      48
    )
    expect(canvasContext.getImageData).toHaveBeenCalledWith(0, 0, resizedWidth, 48)
    expect(mocks.tensor).toHaveBeenCalledExactlyOnceWith(
      'float32',
      expect.any(Float32Array),
      [1, 3, 48, 320]
    )
    const values = mocks.tensor.mock.calls[0][1] as Float32Array
    expect(values).toHaveLength(3 * 48 * 320)
    for (let channel = 0; channel < 3; channel += 1) {
      const firstRow = values.subarray(channel * 48 * 320, channel * 48 * 320 + 320)
      expect([...firstRow]).toEqual([
        ...Array(resizedWidth).fill(1),
        ...Array(320 - resizedWidth).fill(0)
      ])
    }
  }
)

it('최상위 후보의 닉네임과 문자열 확률 점수를 기존 응답 형태로 전달한다', async () => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  mocks.run.mockResolvedValueOnce({
    output: {
      dims: [1, 2, 4],
      data: new Float32Array([0.4, 0.35, 0.25, 0, 0.4, 0.35, 0.25, 0]),
      dispose: outputDispose
    }
  })
  await send({ pixels })
  expect(postMessage).toHaveBeenLastCalledWith({ text: '가', confidence: expect.closeTo(40.25, 5) })
})

it('disposes the input tensor when inference rejects and returns only the public failure', async () => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  mocks.run.mockRejectedValueOnce(new Error('private model failure'))

  await send({ pixels })

  expect(postMessage).toHaveBeenLastCalledWith({ failed: true })
  expect(mocks.dispose).toHaveBeenCalledOnce()
  expect(outputDispose).not.toHaveBeenCalled()
})

it('disposes all output tensors when output validation fails', async () => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  const auxiliaryDispose = vi.fn()
  mocks.run.mockResolvedValueOnce({
    output: { dims: [2, 1, 4], data: new Float32Array(4), dispose: outputDispose },
    auxiliary: { dispose: auxiliaryDispose }
  })

  await send({ pixels })

  expect(postMessage).toHaveBeenLastCalledWith({ failed: true })
  expect(mocks.dispose).toHaveBeenCalledOnce()
  expect(outputDispose).toHaveBeenCalledOnce()
  expect(auxiliaryDispose).toHaveBeenCalledOnce()
})

it('does not attempt inference before model initialization', async () => {
  await send({ pixels })
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ failed: true })
  expect(mocks.run).not.toHaveBeenCalled()
  expect(mocks.tensor).not.toHaveBeenCalled()
})
