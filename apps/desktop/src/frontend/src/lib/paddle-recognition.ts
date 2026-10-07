import { decodeCtcCandidates } from './ctc-candidates'
import { nicknameCenterOffset } from './nickname-pixels'

export { decodeCtcCandidates } from './ctc-candidates'
export type { CtcCandidate } from './ctc-candidates'

/** HUD 글자 경계가 최종 입력 너비의 가운데에 오도록 옮긴 뒤 같은 BGR 정규화를 적용한다. */
export function normalizedNicknameBgr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number
): Float32Array {
  const horizontalOffset = nicknameCenterOffset(rgba, width, height, paddedWidth)

  return normalizedBgrAtOffset(rgba, width, height, paddedWidth, horizontalOffset)
}

/** RGBA 픽셀을 PP-OCRv5용 [-1, 1] 범위의 BGR 채널 배열로 변환하고 오른쪽 여백을 0으로 채운다. */
export function normalizedBgr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number
): Float32Array {
  return normalizedBgrAtOffset(rgba, width, height, paddedWidth, 0)
}

/** 기존 배경색과 zero padding을 유지하고 입력 밖으로 밀린 여백만 제외한다. */
function normalizedBgrAtOffset(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number,
  horizontalOffset: number
): Float32Array {
  const values = new Float32Array(3 * height * paddedWidth)
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
