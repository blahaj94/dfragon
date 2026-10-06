// BT.601의 8비트 RGBA 회색 변환 계수와 반올림 정밀도다.
const grayWeights = { red: 9798, green: 19235, blue: 3735, shift: 15 }
const MIN_CLASS_PROBABILITY = 2 ** -23

/** 닉네임 원본 픽셀을 회색조로 변환한 뒤 블러 없이 Otsu 반전 이진화한다. */
export function binarizeNicknamePixels(data: Uint8ClampedArray): void {
  if (data.length === 0) {
    return
  }
  const histogram = new Uint32Array(256)
  let total = 0
  for (let index = 0; index < data.length; index += 4) {
    const gray =
      (grayWeights.red * data[index] +
        grayWeights.green * data[index + 1] +
        grayWeights.blue * data[index + 2] +
        (1 << (grayWeights.shift - 1))) >>
      grayWeights.shift
    data[index] = gray
    histogram[gray] += 1
    total += gray
  }
  const threshold = findOtsuThreshold(histogram, data.length / 4, total)
  for (let index = 0; index < data.length; index += 4) {
    const value = data[index] > threshold ? 0 : 255
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
    data[index + 3] = 255
  }
}

/** 두 밝기 집단의 분산이 가장 커지는 임계값을 OpenCV의 확률, 평균 계산 순서로 찾는다. */
function findOtsuThreshold(histogram: Uint32Array, count: number, total: number): number {
  const scale = 1 / count
  const mean = total * scale
  let darkProbability = 0
  let darkMean = 0
  let maxVariance = 0
  let threshold = 0
  for (let gray = 0; gray < histogram.length; gray += 1) {
    const probability = histogram[gray] * scale
    darkMean *= darkProbability
    darkProbability += probability
    const lightProbability = 1 - darkProbability
    if (
      Math.min(darkProbability, lightProbability) < MIN_CLASS_PROBABILITY ||
      Math.max(darkProbability, lightProbability) > 1 - MIN_CLASS_PROBABILITY
    ) {
      continue
    }
    darkMean = (darkMean + gray * probability) / darkProbability
    const lightMean = (mean - darkProbability * darkMean) / lightProbability
    const difference = darkMean - lightMean
    const variance = darkProbability * lightProbability * difference * difference
    if (variance > maxVariance) {
      maxVariance = variance
      threshold = gray
    }
  }

  return threshold
}
