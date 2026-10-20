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
      /** 직업명 칸의 1위 문자열. 크롭이 없거나 읽지 못했으면 null이다. */
      jobText: string | null
    })

/** 공대원 닉네임, 직업명 원본을 파티 캡처와 같은 반전 이진화 입력의 canvas로 만든다. */
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
 * 직업명 칸을 닉네임과 같은 전처리로 읽는다. 오프라인 평가에서 원본 색 그대로는 거의 맞지 않았다. 직업명은
 * 서버 확정의 보조 근거라 읽지 못해도 행을 실패로 두지 않고 null로 남긴다.
 */
async function recognizeJob(
  image: CharacterImage | null,
  recognize: PartyOcrWorker['recognize']
): Promise<string | null> {
  if (image === null) {
    return null
  }
  let text: string | undefined
  try {
    const result = await recognize(toNicknameCanvas(image))
    text = result.data.candidates[0]?.nickname.trim()
  } catch {
    return null
  }

  if (text === undefined || text === '' || text.length > MAX_RAID_JOB_TEXT_LENGTH) {
    return null
  }

  return text
}

/**
 * 회차 프레임 한 장에서 main이 자른 공대원 닉네임과 직업명을 화면 순서(1~12행)대로 인식하고 첫 후보를
 * 판정한다. 행 번호가 곧 공대 자리 번호이며, 크롭이 없는 행은 빈 자리로 남긴다. 검색에 쓰지 못할 이름의
 * 행은 직업명을 읽지 않는다.
 */
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
    let data: PartyOcrResult
    try {
      const result = await recognize(toNicknameCanvas(row.nickname))
      data = result.data
    } catch {
      results.push({ kind: 'failed', slot })
      continue
    }
    const candidate = firstCandidate(data)
    const jobText = candidate.kind === 'recognized' ? await recognizeJob(row.job, recognize) : null
    results.push({ ...candidate, slot, jobText })
  }

  return results
}
