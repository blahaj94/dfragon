import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'
import { decodeCtc, normalizedBgr } from './paddle-recognition'

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
  characters = (await response.text()).replace(/\r/g, '').replace(/\n$/, '').split('\n')
  characters.push(' ')
  session = await InferenceSession.create(new URL('korean-rec.onnx', root).toString(), {
    executionProviders: ['wasm'],
    logSeverityLevel: 3
  })
}

/** 이미지 전처리·추론·디코딩을 수행하고 성공과 실패 모두 텐서를 정리한다. */
async function recognizeAndReply(pixels: ImageData): Promise<void> {
  if (session == null) {
    throw new Error('OCR model unavailable.')
  }
  const height = 48
  const width = 320
  const resizedWidth = Math.min(width, Math.ceil((height * pixels.width) / pixels.height))
  const original = new OffscreenCanvas(pixels.width, pixels.height)
  original.getContext('2d')!.putImageData(pixels, 0, 0)
  const resized = new OffscreenCanvas(resizedWidth, height)
  const context = resized.getContext('2d')!
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'low'
  context.drawImage(original, 0, 0, resizedWidth, height)
  const rgba = context.getImageData(0, 0, resizedWidth, height).data
  const tensor = new Tensor('float32', normalizedBgr(rgba, resizedWidth, height, width), [
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
    if (batch !== 1 || classes !== characters.length + 1) {
      throw new Error('OCR model output shape mismatch.')
    }

    postMessage(decodeCtc(output.data as Float32Array, steps, characters))
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
onmessage = async (event: MessageEvent<{ root?: string; pixels?: ImageData }>) => {
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
