import { decodeCtcCandidates } from './ctc-candidates'
import { nicknameCenterOffset } from './nickname-pixels'

export { decodeCtcCandidates } from './ctc-candidates'
export type { CtcCandidate } from './ctc-candidates'

export const MODEL_INPUT_HEIGHT = 48
export const MODEL_INPUT_WIDTH = 320
// 반전 이진화한 HUD 닉네임의 흰 배경과 같은 정규화 값이다.
const NICKNAME_PADDING = 1
const ZERO_PADDING = 0

/** 모델 높이로 리사이즈한 이미지를 선택한 전처리로 [3, 48, 320] BGR 입력 값으로 만든다. */
export function recognitionInputValues(
  pixels: ImageData,
  preprocessing: 'party' | 'raw'
): Float32Array {
  const height = MODEL_INPUT_HEIGHT
  const width = MODEL_INPUT_WIDTH
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

  return normalize(rgba, resizedWidth, height, width)
}

/** 정규화한 BGR 입력을 확인용 RGBA로 되돌리며 zero padding은 중간 회색이 된다. */
export function recognitionInputRgba(
  values: Float32Array,
  width: number,
  height: number
): Uint8ClampedArray {
  const plane = width * height
  if (values.length !== 3 * plane) {
    throw new TypeError('Invalid recognition input dimensions')
  }
  const rgba = new Uint8ClampedArray(plane * 4)
  for (let pixel = 0; pixel < plane; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      rgba[pixel * 4 + (2 - channel)] = (values[channel * plane + pixel] + 1) * 127.5
    }
    rgba[pixel * 4 + 3] = 255
  }

  return rgba
}

/** HUD 글자 경계가 최종 입력 너비의 가운데에 오도록 옮기고 좌우 여백을 흰 배경으로 채운다. */
export function normalizedNicknameBgr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number
): Float32Array {
  const horizontalOffset = nicknameCenterOffset(rgba, width, height, paddedWidth)

  return normalizedBgrAtOffset(rgba, width, height, paddedWidth, horizontalOffset, NICKNAME_PADDING)
}

/** RGBA 픽셀을 PP-OCRv5용 [-1, 1] 범위의 BGR 채널 배열로 변환하고 오른쪽 여백을 0으로 채운다. */
export function normalizedBgr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number
): Float32Array {
  return normalizedBgrAtOffset(rgba, width, height, paddedWidth, 0, ZERO_PADDING)
}

/** 크롭 밖의 입력을 지정한 정규화 값으로 채우고 입력 밖으로 밀린 픽셀은 버린다. */
function normalizedBgrAtOffset(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number,
  horizontalOffset: number,
  padding: number
): Float32Array {
  const values = new Float32Array(3 * height * paddedWidth).fill(padding)
  for (let channel = 0; channel < 3; channel += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const destinationX = x + horizontalOffset
        if (destinationX < 0 || destinationX >= paddedWidth) {
          continue
        }
        values[channel * height * paddedWidth + y * paddedWidth + destinationX] =
          rgba[(y * width + x) * 4 + (2 - channel)] / 127.5 - 1
      }
    }
  }

  return values
}

/** 상위 후보와 같은 탐색, 채점 규칙으로 1위 닉네임 문자열만 반환한다. */
export function decodeCtc(
  data: Float32Array,
  steps: number,
  characters: readonly string[]
): string {
  const first = decodeCtcCandidates(data, steps, characters)[0]
  if (first == null) {
    return ''
  }

  return first.nickname
}
