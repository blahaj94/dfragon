import { beforeEach, expect, it, vi } from 'vitest'
import { validateOcrModel } from './validate-ocr-model.mjs'

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  release: vi.fn(),
  disposeInput: vi.fn(),
  disposeOutput: vi.fn()
}))
vi.mock('onnxruntime-web/wasm', () => ({
  env: { wasm: {} },
  InferenceSession: {
    create: async () => ({
      inputNames: ['input'],
      outputNames: ['output'],
      run: mocks.run,
      release: mocks.release
    })
  },
  Tensor: class {
    dispose = mocks.disposeInput
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.release.mockResolvedValue(undefined)
})

it.each([
  { name: '정규화된 softmax', data: [0.4, 0.35, 0.25, 0.1, 0.2, 0.7], valid: true },
  { name: '음수 logits', data: [-1, 1, 1, 0, 0, 1], valid: false },
  { name: '범위를 넘는 logits', data: [0, 0, 2, 0, 0, 1], valid: false },
  { name: '두 번째 행 합 오류', data: [0, 0, 1, 0.1, 0.1, 0.1], valid: false },
  { name: '확률이 없는 행', data: [0, 0, 0, 0, 0, 1], valid: false }
])('$name을 런타임과 같은 확률 계약으로 검사한다', async ({ data, valid }) => {
  mocks.run.mockResolvedValueOnce({
    output: {
      dims: [1, 2, 3],
      type: 'float32',
      data: new Float32Array(data),
      dispose: mocks.disposeOutput
    }
  })
  const result = validateOcrModel(new Uint8Array(), 3)
  if (valid) {
    await expect(result).resolves.toBeUndefined()
  } else {
    await expect(result).rejects.toThrow(/normalized softmax/)
  }
  expect(mocks.release).toHaveBeenCalledOnce()
  expect(mocks.disposeInput).toHaveBeenCalledOnce()
  expect(mocks.disposeOutput).toHaveBeenCalledOnce()
})
