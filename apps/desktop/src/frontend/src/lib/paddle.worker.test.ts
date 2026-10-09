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

async function send(data: {
  root?: string
  pixels?: ImageData
  preprocessing?: 'party' | 'raw'
}): Promise<void> {
  const receive: ((event: MessageEvent) => unknown) | null = globalThis.onmessage
  await receive?.(new MessageEvent('message', { data: { preprocessing: 'party', ...data } }))
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
  expect(postMessage).toHaveBeenLastCalledWith({
    text: '가',
    confidence: 100,
    candidates: [{ rank: 1, nickname: '가', modelScore: 100 }]
  })
  expect(mocks.dispose).toHaveBeenCalledOnce()
  expect(outputDispose).toHaveBeenCalledOnce()
})

it.each([
  { sourceWidth: 2, sourceHeight: 1, resizedWidth: 96 },
  { sourceWidth: 320, sourceHeight: 48, resizedWidth: 320 },
  { sourceWidth: 400, sourceHeight: 20, resizedWidth: 320 },
  { sourceWidth: 8192, sourceHeight: 1, resizedWidth: 320 }
])(
  '원본 모드의 $sourceWidth×$sourceHeight 이미지를 자르지 않고 48×320 텐서에 맞춘다',
  async ({ sourceWidth, sourceHeight, resizedWidth }) => {
    await send({ root: 'https://fixture.invalid/ocr/' })
    const data = new Uint8ClampedArray(resizedWidth * 48 * 4).fill(255)
    canvasContext.getImageData.mockReturnValueOnce({ data })
    await send({
      pixels: { width: sourceWidth, height: sourceHeight } as ImageData,
      preprocessing: 'raw'
    })

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

it('상위 두 후보와 1위의 닉네임, 모델 점수 호환 필드를 전달한다', async () => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  mocks.run.mockResolvedValueOnce({
    output: {
      dims: [1, 2, 4],
      data: new Float32Array([0.4, 0.35, 0.25, 0, 0.4, 0.35, 0.25, 0]),
      dispose: outputDispose
    }
  })
  await send({ pixels })
  expect(postMessage).toHaveBeenLastCalledWith({
    text: '가',
    confidence: expect.closeTo(40.25, 5),
    candidates: [
      { rank: 1, nickname: '가', modelScore: expect.closeTo(40.25, 5) },
      { rank: 2, nickname: '나', modelScore: expect.closeTo(26.25, 5) }
    ]
  })
})

it('빈 닉네임 후보도 모델 점수와 함께 보존한다', async () => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  mocks.run.mockResolvedValueOnce({
    output: {
      dims: [1, 1, 4],
      data: new Float32Array([1, 0, 0, 0]),
      dispose: outputDispose
    }
  })

  await send({ pixels })

  expect(postMessage).toHaveBeenLastCalledWith({
    text: '',
    confidence: 100,
    candidates: [{ rank: 1, nickname: '', modelScore: 100 }]
  })
})

it('disposes the input tensor when inference rejects and returns only the public failure', async () => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  mocks.run.mockRejectedValueOnce(new Error('private model failure'))

  await send({ pixels })

  expect(postMessage).toHaveBeenLastCalledWith({ failed: true })
  expect(mocks.dispose).toHaveBeenCalledOnce()
  expect(outputDispose).not.toHaveBeenCalled()
})

it.each([
  { name: '잘못된 배치 크기', dims: [2, 1, 4], data: new Float32Array(4) },
  { name: '다른 텐서 자료형', dims: [1, 1, 4], data: new Float64Array([0, 1, 0, 0]) }
])('$name이면 모든 출력 텐서를 정리하고 실패를 반환한다', async ({ dims, data }) => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  const auxiliaryDispose = vi.fn()
  mocks.run.mockResolvedValueOnce({
    output: { dims, data, dispose: outputDispose },
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

it.each([
  { preprocessing: 'party', foregroundX: 159, paddingX: 0, padding: 1 },
  { preprocessing: 'raw', foregroundX: 0, paddingX: 159, padding: 0 }
] as const)(
  'worker의 $preprocessing 입력에 해당 정렬과 여백 값을 적용해 모델에 전달한다',
  async ({ preprocessing, foregroundX, paddingX, padding }) => {
    await send({ root: 'https://fixture.invalid/ocr/' })
    const data = new Uint8ClampedArray(6 * 48 * 4)
    data.fill(255)
    data.set([0, 0, 0, 255, 0, 0, 0, 255], 20 * 6 * 4)
    canvasContext.getImageData.mockReturnValueOnce({ data })
    await send({ pixels: { width: 6, height: 48 } as ImageData, preprocessing })

    expect(mocks.tensor).toHaveBeenCalledOnce()
    const tensor = mocks.tensor.mock.calls[0][1] as Float32Array
    for (let channel = 0; channel < 3; channel += 1) {
      const row = channel * 320 * 48 + 20 * 320
      expect(tensor[row + foregroundX]).toBe(-1)
      expect(tensor[row + foregroundX + 1]).toBe(-1)
      expect(tensor[row + paddingX]).toBe(padding)
      expect(tensor[row - 320 + foregroundX]).toBe(1)
    }
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ text: '가' }))
  }
)
