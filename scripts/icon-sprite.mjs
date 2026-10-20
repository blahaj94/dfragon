// 게임 아이콘 PNG를 한 장의 무손실 WebP sprite로 묶는 도구. 스킬 아이콘(import-skill-data)과 장비 아이콘
// (import-equipment-icons)이 같은 방식으로 칸을 놓고 검사한다.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const RGBA_CHANNELS = 4

export function fail(message) {
  throw new Error(message)
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

// Biome JSON 포맷과 같은 모양(두 칸 들여쓰기, 끝 줄바꿈)으로 쓴다.
export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

// 아이콘 PNG를 색인의 SHA-256과 대조하고 iconSize × iconSize RGBA 픽셀로 읽는다. 칸보다 작은 아이콘은
// 투명한 칸 가운데에 픽셀을 그대로 옮기고, 칸보다 크면 생성을 멈춘다.
export async function readIconPixels(path, sha256, iconSize) {
  const bytes = readFileSync(path)
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== sha256) {
    fail(`아이콘 색인과 PNG의 SHA-256이 다릅니다: ${path}`)
  }
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.width > iconSize || info.height > iconSize) {
    fail(`${iconSize} × ${iconSize}보다 큰 아이콘입니다: ${path}`)
  }

  if (info.width === iconSize && info.height === iconSize) {
    return data
  }
  const cell = Buffer.alloc(iconSize * iconSize * RGBA_CHANNELS)
  const left = Math.floor((iconSize - info.width) / 2)
  const top = Math.floor((iconSize - info.height) / 2)
  const rowBytes = info.width * RGBA_CHANNELS
  for (let y = 0; y < info.height; y += 1) {
    data.copy(cell, ((top + y) * iconSize + left) * RGBA_CHANNELS, y * rowBytes, (y + 1) * rowBytes)
  }

  return cell
}

// sprite 칸 번호의 왼쪽 위 픽셀. 칸 번호는 왼쪽에서 오른쪽, 위에서 아래 순서다.
function cellOrigin(index, { iconSize, columns }) {
  const left = (index % columns) * iconSize
  const top = Math.floor(index / columns) * iconSize

  return { left, top }
}

// 아이콘을 칸 번호 순서로 한 장에 놓은 무손실 WebP. 반투명 픽셀의 값이 합성 반올림으로 바뀌지 않게 픽셀을
// 그대로 복사해 시트를 만들고, 투명 픽셀의 색도 보존한다(`exact`).
export async function encodeSprite(pixels, grid) {
  const { iconSize, columns } = grid
  const rows = Math.ceil(pixels.length / columns)
  const width = columns * iconSize
  const height = rows * iconSize
  const sheet = Buffer.alloc(width * height * RGBA_CHANNELS)
  const rowBytes = iconSize * RGBA_CHANNELS
  pixels.forEach((icon, index) => {
    const { left, top } = cellOrigin(index, grid)
    for (let y = 0; y < iconSize; y += 1) {
      icon.copy(sheet, ((top + y) * width + left) * RGBA_CHANNELS, y * rowBytes, (y + 1) * rowBytes)
    }
  })
  const sprite = await sharp(sheet, { raw: { width, height, channels: RGBA_CHANNELS } })
    .webp({ lossless: true, exact: true, effort: 6 })
    .toBuffer()

  return { sprite, width, height }
}

// sprite를 다시 풀어 모든 칸이 원본 아이콘 픽셀과 같은지 확인한다. 하나라도 다르면 생성을 멈춘다.
export async function checkSprite({ sprite, width, height }, pixels, grid) {
  const { iconSize } = grid
  const { data, info } = await sharp(sprite)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.width !== width || info.height !== height) {
    fail('sprite 크기가 만든 크기와 다릅니다.')
  }
  const rowBytes = iconSize * RGBA_CHANNELS
  pixels.forEach((icon, index) => {
    const { left, top } = cellOrigin(index, grid)
    for (let y = 0; y < iconSize; y += 1) {
      const start = ((top + y) * width + left) * RGBA_CHANNELS
      const expected = icon.subarray(y * rowBytes, (y + 1) * rowBytes)
      if (!data.subarray(start, start + rowBytes).equals(expected)) {
        fail(`sprite의 ${index}번 칸이 원본 아이콘과 다릅니다.`)
      }
    }
  })
}
