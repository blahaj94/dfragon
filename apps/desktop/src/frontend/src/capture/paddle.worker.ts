import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'
import { decodeCtc, normalizedBgr } from './paddle-recognition'

let session: InferenceSession | null = null
let characters: string[] = []

onmessage = async (event: MessageEvent<{ root?: string; pixels?: ImageData }>) => {
  try {
    const { root, pixels } = event.data
    if (root != null) {
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
      postMessage({ ready: true })
      return
    }
    if (session == null || pixels == null) {
      throw new Error('OCR model unavailable.')
    }
    const height = 48
    const resizedWidth = Math.ceil((height * pixels.width) / pixels.height)
    const width = Math.max(320, resizedWidth)
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
  } catch {
    // Never forward model exceptions, image pixels, or recognized names to logs.
    postMessage({ failed: true })
  }
}
