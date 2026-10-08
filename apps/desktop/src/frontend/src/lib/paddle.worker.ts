import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'
import { decodeCtcCandidates, normalizedBgr, normalizedNicknameBgr } from './paddle-recognition'
import type { PartyOcrResult } from '../types/capture'

const DICTIONARY_CARRIAGE_RETURN_PATTERN = /\r/g
const DICTIONARY_FINAL_NEWLINE_PATTERN = /\n$/
const MODEL_HEIGHT = 48
const MODEL_WIDTH = 320

let session: InferenceSession | null = null
let characters: string[] = []

/** WASM 옵션과 사전을 준비한 뒤 같은 모델 세션으로 이미지를 인식한다. */
async function initializeModel(root: string): Promise<void> {
  env.logLevel = 'error'
  env.wasm.numThreads = 1
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
  session = await InferenceSession.create(new URL('korean-rec.onnx', root).toString(), {
    executionProviders: ['wasm'],
    logSeverityLevel: 3
  })
}

/** 이미지 전처리, 추론, 디코딩을 수행하고 성공과 실패 모두 텐서를 정리한다. */
async function recognizeAndReply(pixels: ImageData, preprocessing: 'party' | 'raw'): Promise<void> {
  if (session == null) {
    throw new Error('OCR model unavailable.')
  }
  const height = MODEL_HEIGHT
  const width = MODEL_WIDTH
  const resizedWidth = Math.min(width, Math.ceil((height * pixels.width) / pixels.height))
  const original = new OffscreenCanvas(pixels.width, pixels.height)
  original.getContext('2d')!.putImageData(pixels, 0, 0)
  const resized = new OffscreenCanvas(resizedWidth, height)
  const context = resized.getContext('2d')!
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'low'
  context.drawImage(original, 0, 0, resizedWidth, height)
  const rgba = context.getImageData(0, 0, resizedWidth, height).data
  const normalize = preprocessing === 'party' ? normalizedNicknameBgr : normalizedBgr
  const tensor = new Tensor('float32', normalize(rgba, resizedWidth, height, width), [
    1,
    3,
    height,
    width
  ])
  let outputs: InferenceSession.ReturnType | undefined
  try {
    outputs = await session.run({ [session.inputNames[0]]: tensor })
    const output = outputs[session.outputNames[0]]
    const [batch, steps, classes] = output.dims
    if (
      batch !== 1 ||
      classes !== characters.length + 1 ||
      !(output.data instanceof Float32Array)
    ) {
      throw new Error('OCR model output shape mismatch.')
    }

    const candidates = decodeCtcCandidates(output.data, steps, characters)
    const first = candidates[0]
    const text = first?.nickname ?? ''
    const confidence = first?.modelScore ?? 0
    postMessage({ text, confidence, candidates } satisfies PartyOcrResult)
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
onmessage = async (
  event: MessageEvent<{ root?: string; pixels?: ImageData; preprocessing?: 'party' | 'raw' }>
) => {
  try {
    const { root, pixels, preprocessing } = event.data
    if (root != null) {
      await initializeModel(root)
      postMessage({ ready: true })

      return
    }

    if (pixels == null || (preprocessing !== 'party' && preprocessing !== 'raw')) {
      throw new Error('OCR model unavailable.')
    }
    await recognizeAndReply(pixels, preprocessing)
  } catch {
    // Never forward model exceptions, image pixels, or recognized names to logs.
    postMessage({ failed: true })
  }
}
