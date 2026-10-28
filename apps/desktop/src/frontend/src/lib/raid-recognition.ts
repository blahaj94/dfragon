import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import type { RaidFrameRow } from '../../../preload/common/types/capture'
import type { CharacterImage } from '../../../preload/common/types/character'
import { MAX_RAID_JOB_TEXT_LENGTH } from '../../../preload/common/types/search'
import { binarizeNicknamePixels } from './nickname-pixels'
import { firstCandidate, type FirstCandidate } from './party-recognition'

export type RaidSlotRecognition =
  | { kind: 'missing'; slot: number }
  | { kind: 'failed'; slot: number }
  | (FirstCandidate & {
      slot: number
      jobText: string | null
    })

function toNicknameCanvas(image: CharacterImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context == null) {
    throw new Error('Could not create a raid nickname canvas.')
  }
  const pixels = context.createImageData(image.width, image.height)
  pixels.data.set(image.rgba)
  binarizeNicknamePixels(pixels.data)
  context.putImageData(pixels, 0, 0)

  return canvas
}

async function recognizeImage(
  recognize: PartyOcrWorker['recognize'],
  image: CharacterImage
): Promise<PartyOcrResult | null> {
  try {
    const result = await recognize(toNicknameCanvas(image))

    return result.data
  } catch {
    return null
  }
}

/**
 * 오프라인 평가에서 원본 색 그대로는 거의 맞지 않았다.
 */
async function recognizeJob(
  image: CharacterImage | null,
  recognize: PartyOcrWorker['recognize']
): Promise<string | null> {
  if (image === null) {
    return null
  }
  const data = await recognizeImage(recognize, image)
  if (data === null) {
    return null
  }
  const text = data.candidates[0]?.nickname.trim()
  if (text === undefined || text === '' || text.length > MAX_RAID_JOB_TEXT_LENGTH) {
    return null
  }

  return text
}

export async function recognizeRaidRows(
  rows: readonly (RaidFrameRow | null)[],
  recognize: PartyOcrWorker['recognize']
): Promise<RaidSlotRecognition[]> {
  const results: RaidSlotRecognition[] = []
  for (const [slot, row] of rows.entries()) {
    if (row === null) {
      results.push({ kind: 'missing', slot })
      continue
    }
    const data = await recognizeImage(recognize, row.nickname)
    if (data === null) {
      results.push({ kind: 'failed', slot })
      continue
    }
    const candidate = firstCandidate(data)
    const jobText = candidate.kind === 'recognized' ? await recognizeJob(row.job, recognize) : null
    results.push({ ...candidate, slot, jobText })
  }

  return results
}
