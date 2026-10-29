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
  vi.stubGlobal('navigator', { hardwareConcurrency: 16 })
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
    wasm: { numThreads: 8, proxy: false, wasmPaths: 'https://fixture.invalid/ocr/ort/' }
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
    candidates: [{ rank: 1, nickname: '가', modelScore: 100 }]
  })
  expect(mocks.dispose).toHaveBeenCalledOnce()
  expect(outputDispose).toHaveBeenCalledOnce()
})

it.each([
  { cores: 2, threads: 2 },
  { cores: 4, threads: 4 },
  { cores: 8, threads: 8 },
  { cores: 32, threads: 8 }
])('논리 코어 $cores개에서 OCR을 $threads thread로 돌린다', async ({ cores, threads }) => {
  vi.stubGlobal('navigator', { hardwareConcurrency: cores })

  await send({ root: 'https://fixture.invalid/ocr/' })

  expect(mocks.env.wasm.numThreads).toBe(threads)
})

it.each([
  { sourceWidth: 2, sourceHeight: 1, resizedWidth: 96, left: 112 },
  { sourceWidth: 320, sourceHeight: 48, resizedWidth: 320, left: 0 },
  { sourceWidth: 400, sourceHeight: 20, resizedWidth: 320, left: 0 },
  { sourceWidth: 8192, sourceHeight: 1, resizedWidth: 320, left: 0 }
])(
  '$sourceWidth×$sourceHeight 이미지를 자르지 않고 48×320 텐서 가운데에 맞춘다',
  async ({ sourceWidth, sourceHeight, resizedWidth, left }) => {
    await send({ root: 'https://fixture.invalid/ocr/' })
    const data = new Uint8ClampedArray(resizedWidth * 48 * 4)
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
        ...Array(left).fill(1),
        ...Array(resizedWidth).fill(-1),
        ...Array(320 - left - resizedWidth).fill(1)
      ])
    }
  }
)

it('상위 두 후보를 순위, 모델 점수와 함께 전달한다', async () => {
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
  { name: '잘못된 배치 크기', dims: [2, 1, 4], data: new Float32Array([0, 1, 0, 0]) },
  { name: '사전과 다른 class 수', dims: [1, 1, 5], data: new Float32Array([0, 1, 0, 0, 0]) },
  {
    name: '배열 길이와 다른 step 수',
    dims: [1, 1, 4],
    data: new Float32Array([0, 1, 0, 0, 0, 1, 0, 0])
  },
  { name: '음수 step 수', dims: [1, -1, 4], data: new Float32Array() },
  { name: '다른 텐서 자료형', dims: [1, 1, 4], data: new Float64Array([0, 1, 0, 0]) }
])('$name: 모든 출력 텐서를 정리하고 실패를 반환한다', async ({ dims, data }) => {
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

it('닉네임 글자를 가운데로 옮기고 좌우 여백을 흰색으로 채워 모델에 전달한다', async () => {
  await send({ root: 'https://fixture.invalid/ocr/' })
  const data = new Uint8ClampedArray(6 * 48 * 4)
  data.fill(255)
  data.set([0, 0, 0, 255, 0, 0, 0, 255], 20 * 6 * 4)
  canvasContext.getImageData.mockReturnValueOnce({ data })
  await send({ pixels: { width: 6, height: 48 } as ImageData })

  expect(mocks.tensor).toHaveBeenCalledOnce()
  const tensor = mocks.tensor.mock.calls[0][1] as Float32Array
  for (let channel = 0; channel < 3; channel += 1) {
    const row = channel * 320 * 48 + 20 * 320
    expect(tensor[row + 159]).toBe(-1)
    expect(tensor[row + 160]).toBe(-1)
    expect(tensor[row]).toBe(1)
    expect(tensor[row - 320 + 159]).toBe(1)
  }
  expect(postMessage).toHaveBeenLastCalledWith({
    candidates: [{ rank: 1, nickname: '가', modelScore: 100 }]
  })
})

it.each([
  { name: '중복 문자', dictionary: '가\n가\n' },
  { name: '끝에 붙는 공백과 겹치는 문자', dictionary: '가\n \n' },
  { name: '여러 문자로 된 label', dictionary: '가나\n' }
])('사전 오류($name)는 모델을 만들지 않고 초기화 실패로 응답한다', async ({ dictionary }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(dictionary))
  )

  await send({ root: 'https://fixture.invalid/ocr/' })

  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ failed: true })
  expect(mocks.create).not.toHaveBeenCalled()
})
