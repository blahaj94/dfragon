import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'
import { assertCtcLabels, decodeCtcCandidates } from './ctc-candidates'
import { MODEL_INPUT_HEIGHT, MODEL_INPUT_WIDTH, recognitionInputValues } from './paddle-recognition'
import type { PartyOcrResult } from '../types/capture'

const DICTIONARY_CARRIAGE_RETURN_PATTERN = /\r/g
const DICTIONARY_FINAL_NEWLINE_PATTERN = /\n$/
// 같은 WASM 빌드를 Node에서 Apple M3 Max(논리 코어 16개)로 재 보니 1장 추론이 8 thread와 12 thread 모두 약 23ms로
// 8개를 넘으면 빨라지지 않았고, 코어 수를 넘긴 32, 64 thread는 약 34ms, 48ms로 오히려 느려졌다.
const MAX_THREADS = 8

let session: InferenceSession | null = null
let characters: string[] = []

async function initializeModel(root: string): Promise<void> {
  env.logLevel = 'error'
  // onnxruntime-web은 cross-origin 격리가 아닌 페이지에서 기본값을 1 thread로 잡으므로 직접 정한다.
  env.wasm.numThreads = Math.min(MAX_THREADS, navigator.hardwareConcurrency)
  env.wasm.proxy = false
  env.wasm.wasmPaths = new URL('ort/', root).toString()
  const response = await fetch(new URL('korean-dict.txt', root))
  if (!response.ok) {
    throw new Error('OCR dictionary unavailable.')
  }
  characters = (await response.text())
    .replace(DICTIONARY_CARRIAGE_RETURN_PATTERN, '')
    .replace(DICTIONARY_FINAL_NEWLINE_PATTERN, '')
    .split('\n')
  characters.push(' ')
  assertCtcLabels(characters)
  session = await InferenceSession.create(new URL('korean-rec.onnx', root).toString(), {
    executionProviders: ['wasm'],
    logSeverityLevel: 3
  })
}

/** 이미지 전처리, 추론, 디코딩을 수행하고 성공과 실패 모두 텐서를 정리한다. */
async function recognizeAndReply(pixels: ImageData): Promise<void> {
  if (session == null) {
    throw new Error('OCR model unavailable.')
  }
  const tensor = new Tensor('float32', recognitionInputValues(pixels), [
    1,
    3,
    MODEL_INPUT_HEIGHT,
    MODEL_INPUT_WIDTH
  ])
  let outputs: InferenceSession.ReturnType | undefined
  try {
    outputs = await session.run({ [session.inputNames[0]]: tensor })
    const output = outputs[session.outputNames[0]]
    const [batch, steps, classes] = output.dims
    if (
      batch !== 1 ||
      !Number.isSafeInteger(steps) ||
      classes !== characters.length + 1 ||
      !(output.data instanceof Float32Array) ||
      output.data.length !== steps * classes
    ) {
      throw new Error('OCR model output shape mismatch.')
    }

    const candidates = decodeCtcCandidates(output.data, steps, characters)
    postMessage({ candidates } satisfies PartyOcrResult)
  } finally {
    tensor.dispose()
    if (outputs != null) {
      for (const value of Object.values(outputs)) {
        value.dispose()
      }
    }
  }
}

// 메시지 경계는 모델 내부 오류를 노출하지 않고 공개 응답만 전달한다.
globalThis.onmessage = async (event: MessageEvent<{ root?: string; pixels?: ImageData }>) => {
  try {
    const { root, pixels } = event.data
    if (root != null) {
      await initializeModel(root)
      postMessage({ ready: true })

      return
    }

    if (pixels == null) {
      throw new Error('OCR model unavailable.')
    }
    await recognizeAndReply(pixels)
  } catch {
    // Never forward model exceptions, image pixels, or recognized names to logs.
    postMessage({ failed: true })
  }
}
