import { readFileSync } from 'node:fs'
import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'
import { decodeCtcCandidates } from '../../src/frontend/src/lib/ctc-candidates'
import { binarizeNicknamePixels } from '../../src/frontend/src/lib/nickname-pixels'
import {
  MODEL_INPUT_HEIGHT,
  MODEL_INPUT_WIDTH,
  normalizedBgr,
  normalizedNicknameBgr
} from '../../src/frontend/src/lib/paddle-recognition'
import type { CharacterImage } from '../../src/preload/common/types/character'

const RGBA_CHANNELS = 4
const DICTIONARY_CARRIAGE_RETURN_PATTERN = /\r/g
const DICTIONARY_FINAL_NEWLINE_PATTERN = /\n$/

/**
 * `nickname`은 공대 닉네임과 같은 반전 이진화와 가운데 정렬, `raw`는 원본 색 그대로다. 제품의 직업명
 * 인식 경로는 아직 없으므로 두 전처리를 모두 측정한다.
 */
export type JobOcrPreprocessing = 'nickname' | 'raw'
export type JobOcrReader = (
  crop: CharacterImage,
  preprocessing: JobOcrPreprocessing
) => Promise<string>

/**
 * renderer의 canvas `imageSmoothingQuality: 'low'` 축소를 node에서 쌍선형 보간으로 근사한다. 브라우저의
 * 결과와 픽셀 단위로 같지는 않다.
 */
function resizeBilinear(
  image: Readonly<{ width: number; height: number; rgba: Uint8Array | Uint8ClampedArray }>,
  width: number,
  height: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * RGBA_CHANNELS)
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.max(
      0,
      Math.min(image.height - 1, ((y + 0.5) * image.height) / height - 0.5)
    )
    const top = Math.floor(sourceY)
    const bottom = Math.min(image.height - 1, top + 1)
    const vertical = sourceY - top
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.max(
        0,
        Math.min(image.width - 1, ((x + 0.5) * image.width) / width - 0.5)
      )
      const left = Math.floor(sourceX)
      const right = Math.min(image.width - 1, left + 1)
      const horizontal = sourceX - left
      for (let channel = 0; channel < RGBA_CHANNELS; channel += 1) {
        const at = (px: number, py: number): number =>
          image.rgba[(py * image.width + px) * RGBA_CHANNELS + channel]
        const upper = at(left, top) * (1 - horizontal) + at(right, top) * horizontal
        const lower = at(left, bottom) * (1 - horizontal) + at(right, bottom) * horizontal
        output[(y * width + x) * RGBA_CHANNELS + channel] =
          upper * (1 - vertical) + lower * vertical
      }
    }
  }

  return output
}

function recognitionInput(crop: CharacterImage, preprocessing: JobOcrPreprocessing): Float32Array {
  const pixels = Uint8ClampedArray.from(crop.rgba)
  if (preprocessing === 'nickname') {
    binarizeNicknamePixels(pixels)
  }
  const height = MODEL_INPUT_HEIGHT
  const width = Math.min(MODEL_INPUT_WIDTH, Math.ceil((height * crop.width) / crop.height))
  const resized = resizeBilinear(
    { width: crop.width, height: crop.height, rgba: pixels },
    width,
    height
  )
  const normalize = preprocessing === 'nickname' ? normalizedNicknameBgr : normalizedBgr

  return normalize(resized, width, height, MODEL_INPUT_WIDTH)
}

/** 앱 worker와 같은 WASM 엔진, 사전, CTC 디코딩으로 직업명 크롭의 1위 문자열을 읽는다. */
export async function createJobOcrReader(
  modelPath: string,
  dictionaryPath: string
): Promise<JobOcrReader> {
  env.logLevel = 'fatal'
  // 다중 thread WASM은 node에서 worker를 띄우다 멈출 수 있어 앱 worker와 같이 한 thread로 돈다.
  env.wasm.numThreads = 1
  env.wasm.proxy = false
  const characters = readFileSync(dictionaryPath, 'utf8')
    .replace(DICTIONARY_CARRIAGE_RETURN_PATTERN, '')
    .replace(DICTIONARY_FINAL_NEWLINE_PATTERN, '')
    .split('\n')
  characters.push(' ')
  const session = await InferenceSession.create(readFileSync(modelPath), {
    executionProviders: ['wasm'],
    logSeverityLevel: 4
  })

  return async (crop, preprocessing) => {
    const tensor = new Tensor('float32', recognitionInput(crop, preprocessing), [
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
        classes !== characters.length + 1 ||
        !(output.data instanceof Float32Array)
      ) {
        throw new Error('OCR 모델 출력 형태가 사전과 맞지 않습니다')
      }

      const best = decodeCtcCandidates(output.data, steps, characters)[0]
      if (best === undefined) {
        return ''
      }

      return best.nickname
    } finally {
      tensor.dispose()
      for (const value of Object.values(outputs ?? {})) {
        value.dispose()
      }
    }
  }
}
