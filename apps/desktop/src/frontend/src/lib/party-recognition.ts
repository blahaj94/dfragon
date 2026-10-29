import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import type { CharacterImage, CharacterPortrait } from '../../../preload/common/types/character'
import { capturePartyRecognitionInputs } from './party'
import type { OcrNicknameRejection } from './runtime-diagnostics'

const MAX_NICKNAME_CODE_POINTS = 12
const UNPAIRED_SURROGATE_PATTERN = /[\uD800-\uDFFF]/u

export type FirstCandidate =
  | { kind: 'recognized'; nickname: string }
  | { kind: 'rejected'; rejection: OcrNicknameRejection; text: string | null }

export type PartySlotRecognition =
  | { kind: 'missing'; slot: number }
  | { kind: 'failed'; slot: number; portrait: CharacterPortrait | null }
  | (FirstCandidate & {
      slot: number
      portrait: CharacterPortrait | null
    })

export async function recognizeBinarizedText(
  recognize: PartyOcrWorker['recognize'],
  image: HTMLCanvasElement
): Promise<PartyOcrResult | null> {
  try {
    return await recognize(image)
  } catch {
    return null
  }
}

export async function recognizePartyFrame(
  frame: CharacterImage,
  recognize: PartyOcrWorker['recognize']
): Promise<PartySlotRecognition[]> {
  const inputs = capturePartyRecognitionInputs(frame)
  const results: PartySlotRecognition[] = []
  for (const [slot, input] of inputs.entries()) {
    if (input === null) {
      results.push({ kind: 'missing', slot })
      continue
    }
    const data = await recognizeBinarizedText(recognize, input.nickname)
    if (data === null) {
      results.push({ kind: 'failed', slot, portrait: input.portrait })
      continue
    }
    results.push({
      ...firstCandidate(data),
      slot,
      portrait: input.portrait
    })
  }

  return results
}

export function firstCandidate(result: PartyOcrResult): FirstCandidate {
  const text = result.candidates[0]?.nickname
  if (text == null) {
    return { kind: 'rejected', rejection: 'missing', text: null }
  }
  const nickname = text.trim()
  const length = [...nickname].length
  if (length === 0) {
    return { kind: 'rejected', rejection: 'empty', text }
  }

  if (length > MAX_NICKNAME_CODE_POINTS) {
    return { kind: 'rejected', rejection: 'too-long', text }
  }

  if (UNPAIRED_SURROGATE_PATTERN.test(nickname)) {
    return { kind: 'rejected', rejection: 'malformed', text }
  }

  return { kind: 'recognized', nickname }
}
