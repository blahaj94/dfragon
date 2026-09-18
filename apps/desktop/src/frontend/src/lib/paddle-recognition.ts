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

/** CTC 출력에서 blank와 연속 중복을 제거해 문자열을 만들고, 채택한 문자 점수의 평균을 100배 한 신뢰도를 반환한다. */
export function decodeCtc(
  data: Float32Array,
  steps: number,
  characters: readonly string[]
): { text: string; confidence: number } {
  const classes = characters.length + 1
  if (data.length !== steps * classes) {
    throw new Error('OCR model output shape mismatch.')
  }
  let text = ''
  let previous = -1
  let score = 0
  let count = 0
  for (let step = 0; step < steps; step += 1) {
    let best = 0
    for (let index = 1; index < classes; index += 1) {
      if (data[step * classes + index] > data[step * classes + best]) {
        best = index
      }
    }
    // A blank separates equal characters; only adjacent nonblank repeats collapse.
    if (best > 0 && best !== previous) {
      text += characters[best - 1]
      score += data[step * classes + best]
      count += 1
    }
    previous = best
  }
  return { text, confidence: count > 0 ? (score / count) * 100 : 0 }
}
