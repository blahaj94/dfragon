import type { DNFRectangle } from '@dfragon/lib'
import type {
  RaidFrameResult,
  RaidFrameRow,
  WindowFrameResult
} from '../../preload/common/types/capture'
import type { CharacterImage } from '../../preload/common/types/character'
import { cropRaidWindowNicknames, readRaidWindowValues } from '../lib/raid-window'

const RGBA_CHANNELS = 4
const ALPHA_CHANNEL = 3

/** 다른 창에 가려 GDI가 투명하게 제외한 픽셀이 있으면 그 칸은 읽지 않는다. */
function containsExcludedPixels(rgba: Uint8Array | Uint8ClampedArray): boolean {
  for (let index = ALPHA_CHANNEL; index < rgba.length; index += RGBA_CHANNELS) {
    if (rgba[index] === 0) {
      return true
    }
  }

  return false
}

function copyRegion(frame: CharacterImage, region: DNFRectangle): CharacterImage | null {
  const { x, y, width, height } = region
  const rgba = new Uint8Array(width * height * RGBA_CHANNELS)
  for (let line = 0; line < height; line += 1) {
    const start = ((y + line) * frame.width + x) * RGBA_CHANNELS
    rgba.set(
      frame.rgba.subarray(start, start + width * RGBA_CHANNELS),
      line * width * RGBA_CHANNELS
    )
  }
  if (containsExcludedPixels(rgba)) {
    return null
  }

  return { width, height, rgba }
}

export function toRaidFrameResult(result: WindowFrameResult): RaidFrameResult {
  if (result.kind !== 'frame') {
    return result
  }
  const detection = cropRaidWindowNicknames(result.image)
  if (detection.status === 'not-found') {
    return { kind: 'missing', reason: 'not-found' }
  }

  if (detection.status !== 'found') {
    return { kind: 'missing', reason: 'uncertain' }
  }
  const { valueColumn, valueTexts } = readRaidWindowValues(result.image, detection)
  const rows = detection.rows.map((row, index): RaidFrameRow | null => {
    const crop = row.nicknameCrop
    if (crop === null || containsExcludedPixels(crop.rgba)) {
      return null
    }
    const { width, height } = crop
    const nickname = { width, height, rgba: Uint8Array.from(crop.rgba) }
    const job = copyRegion(result.image, row.jobRegion)

    return { nickname, job, valueText: valueTexts[index] }
  })

  return { kind: 'rows', valueColumn, rows }
}
