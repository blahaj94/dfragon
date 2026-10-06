import { decodeCtcCandidates } from './ctc-candidates'

export { decodeCtcCandidates } from './ctc-candidates'
export type { CtcCandidate } from './ctc-candidates'

/** RGBA 픽셀을 PP-OCRv5용 [-1, 1] 범위의 BGR 채널 배열로 변환하고 오른쪽 여백을 0으로 채운다. */
export function normalizedBgr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number
): Float32Array {
  const values = new Float32Array(3 * height * paddedWidth)
  for (let channel = 0; channel < 3; channel += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        values[channel * height * paddedWidth + y * paddedWidth + x] =
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
