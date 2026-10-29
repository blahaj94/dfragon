// BT.601의 8비트 RGBA 회색 변환 계수와 반올림 정밀도다.
const grayWeights = { red: 9798, green: 19235, blue: 3735, shift: 15 }
const MIN_CLASS_PROBABILITY = 2 ** -23
const RGBA_CHANNELS = 4
const NICKNAME_BACKGROUND = 255
// 관측한 HUD 닉네임의 위아래 여백 안에 걸친 프레임 장식만 경계 계산에서 제외한다.
const HUD_EDGE_MARGIN_RATIO = 1 / 5
const HUD_FRAME_LINE_WIDTH_RATIO = 3 / 4
// 게임 닉네임에는 공백이 없다. UI 0% 높이 17px 공대 닉네임 칸에서 공백 한 칸 폭(4px) 이상
// 떨어진 덩어리는 레이드 보상 테두리에서 튄 점 같은 이름 밖의 픽셀로 본다(2026-10-30 결정).
const RAID_DETACHED_GAP_RATIO = 4 / 17

function excludeNicknameFrameLines(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  margin: number,
  excluded: Uint8Array
): void {
  const minLineWidth = Math.ceil(width * HUD_FRAME_LINE_WIDTH_RATIO)
  for (let y = 0; y < height; y += 1) {
    if (y >= margin && y < height - margin) {
      continue
    }
    let start = 0
    for (let x = 0; x <= width; x += 1) {
      if (x < width && rgba[(y * width + x) * RGBA_CHANNELS] < NICKNAME_BACKGROUND) {
        continue
      }

      if (x - start >= minLineWidth) {
        excluded.fill(1, y * width + start, y * width + x)
      }
      start = x + 1
    }
  }
}

function nicknameFramePixels(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const excluded = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const pending = new Int32Array(width * height)
  const margin = Math.floor(height * HUD_EDGE_MARGIN_RATIO)
  excludeNicknameFrameLines(rgba, width, height, margin, excluded)
  for (const edgeY of [0, height - 1]) {
    for (let edgeX = 0; edgeX < width; edgeX += 1) {
      const seed = edgeY * width + edgeX
      if (
        excluded[seed] !== 0 ||
        visited[seed] !== 0 ||
        rgba[seed * RGBA_CHANNELS] === NICKNAME_BACKGROUND
      ) {
        continue
      }
      let count = 1
      let minY = edgeY
      let maxY = edgeY
      pending[0] = seed
      visited[seed] = 1
      for (let index = 0; index < count; index += 1) {
        const pixel = pending[index]
        const x = pixel % width
        const y = Math.floor(pixel / width)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nextX = x + dx
            const nextY = y + dy
            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
              continue
            }
            const neighbor = nextY * width + nextX
            if (
              visited[neighbor] === 0 &&
              excluded[neighbor] === 0 &&
              rgba[neighbor * RGBA_CHANNELS] < NICKNAME_BACKGROUND
            ) {
              visited[neighbor] = 1
              pending[count] = neighbor
              count += 1
            }
          }
        }
      }

      if (maxY < margin || minY >= height - margin) {
        for (let index = 0; index < count; index += 1) {
          excluded[pending[index]] = 1
        }
      }
    }
  }

  return excluded
}

export function nicknameCenterOffset(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  paddedWidth: number
): number {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    !Number.isSafeInteger(paddedWidth) ||
    width < 1 ||
    height < 1 ||
    paddedWidth < width ||
    rgba.length !== width * height * RGBA_CHANNELS
  ) {
    throw new TypeError('Invalid nickname centering dimensions')
  }
  const framePixels = nicknameFramePixels(rgba, width, height)
  let left = width
  let right = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x
      if (framePixels[pixel] === 0 && rgba[pixel * RGBA_CHANNELS] < NICKNAME_BACKGROUND) {
        left = Math.min(left, x)
        right = Math.max(right, x)
      }
    }
  }
  if (right < left) {
    return Math.floor((paddedWidth - width) / 2)
  }
  const glyphWidth = right - left + 1
  const destinationLeft = Math.floor((paddedWidth - glyphWidth) / 2)

  return destinationLeft - left
}

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

export function removeDetachedRaidNicknamePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const minGap = Math.max(1, Math.round(height * RAID_DETACHED_GAP_RATIO))
  const clusters: { left: number; right: number; count: number }[] = []
  for (let x = 0; x < width; x += 1) {
    let count = 0
    for (let y = 0; y < height; y += 1) {
      if (data[(y * width + x) * RGBA_CHANNELS] < NICKNAME_BACKGROUND) {
        count += 1
      }
    }
    if (count === 0) {
      continue
    }
    const last = clusters.at(-1)
    if (last !== undefined && x - last.right - 1 < minGap) {
      last.right = x
      last.count += count
    } else {
      clusters.push({ left: x, right: x, count })
    }
  }
  let main: (typeof clusters)[number] | undefined
  for (const cluster of clusters) {
    if (main === undefined || cluster.count > main.count) {
      main = cluster
    }
  }
  for (const cluster of clusters) {
    if (cluster === main) {
      continue
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = cluster.left; x <= cluster.right; x += 1) {
        const index = (y * width + x) * RGBA_CHANNELS
        data.fill(NICKNAME_BACKGROUND, index, index + 3)
      }
    }
  }
}

function toTextCanvas(
  image: Readonly<{ width: number; height: number; rgba: ArrayLike<number> }>,
  prepare: (pixels: ImageData) => void
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context == null) {
    throw new Error('Could not create a text recognition canvas.')
  }
  const pixels = context.createImageData(image.width, image.height)
  pixels.data.set(image.rgba)
  prepare(pixels)
  context.putImageData(pixels, 0, 0)

  return canvas
}

export function toBinarizedTextCanvas(
  image: Readonly<{ width: number; height: number; rgba: ArrayLike<number> }>
): HTMLCanvasElement {
  return toTextCanvas(image, (pixels) => binarizeNicknamePixels(pixels.data))
}

export function toRaidNicknameCanvas(
  image: Readonly<{ width: number; height: number; rgba: ArrayLike<number> }>
): HTMLCanvasElement {
  return toTextCanvas(image, (pixels) => {
    binarizeNicknamePixels(pixels.data)
    removeDetachedRaidNicknamePixels(pixels.data, pixels.width, pixels.height)
  })
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
