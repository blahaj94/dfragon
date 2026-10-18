import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import type { CharacterImage } from '../../../preload/common/types/character'
import { binarizeNicknamePixels } from './nickname-pixels'
import { firstCandidate, type FirstCandidate } from './party-recognition'

export type RaidSlotRecognition =
  | { kind: 'missing'; slot: number }
  | { kind: 'failed'; slot: number }
  | (FirstCandidate & { slot: number })

/** 공대원 닉네임 원본을 파티 캡처와 같은 반전 이진화 입력의 canvas로 만든다. */
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

/**
 * 회차 프레임 한 장에서 main이 자른 공대원 닉네임을 화면 순서(1~12행)대로 인식하고 첫 후보를 판정한다. 행
 * 번호가 곧 공대 자리 번호이며, 크롭이 없는 행은 빈 자리로 남긴다.
 */
export async function recognizeRaidRows(
  nicknames: readonly (CharacterImage | null)[],
  recognize: PartyOcrWorker['recognize']
): Promise<RaidSlotRecognition[]> {
  const results: RaidSlotRecognition[] = []
  for (const [slot, image] of nicknames.entries()) {
    if (image === null) {
      results.push({ kind: 'missing', slot })
      continue
    }
    let data: PartyOcrResult
    try {
      const result = await recognize(toNicknameCanvas(image))
      data = result.data
    } catch {
      results.push({ kind: 'failed', slot })
      continue
    }
    results.push({ ...firstCandidate(data), slot })
  }

  return results
}
