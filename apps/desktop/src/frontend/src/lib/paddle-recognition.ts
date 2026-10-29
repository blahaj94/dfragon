import { nicknameCenterOffset } from './nickname-pixels'

export const MODEL_INPUT_HEIGHT = 48
export const MODEL_INPUT_WIDTH = 320
const NICKNAME_PADDING = 1
const ZERO_PADDING = 0

export function recognitionInputValues(pixels: ImageData): Float32Array {
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

  return normalizedNicknameBgr(rgba, resizedWidth, height, width)
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
