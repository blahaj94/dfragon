import { decodeCtcCandidates } from './ctc-candidates'
import { nicknameCenterOffset } from './nickname-pixels'

export { decodeCtcCandidates } from './ctc-candidates'
export type { CtcCandidate } from './ctc-candidates'

export const MODEL_INPUT_HEIGHT = 48
export const MODEL_INPUT_WIDTH = 320
const NICKNAME_PADDING = 1
const ZERO_PADDING = 0

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

export function normalizedNicknameBgr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number
): Float32Array {
  const horizontalOffset = nicknameCenterOffset(rgba, width, height, paddedWidth)

  return normalizedBgrAtOffset(rgba, width, height, paddedWidth, horizontalOffset, NICKNAME_PADDING)
}

export function normalizedBgr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number
): Float32Array {
  return normalizedBgrAtOffset(rgba, width, height, paddedWidth, 0, ZERO_PADDING)
}

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
