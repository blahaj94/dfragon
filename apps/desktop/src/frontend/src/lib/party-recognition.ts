import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import type { CharacterImage, CharacterPortrait } from '@dfragon/desktop-contracts/types/character'
import { capturePartyRecognitionInputs } from './party'
import { normalizeNickname } from './recognition'
import type { OcrNicknameRejection } from './runtime-diagnostics'

const MAX_NICKNAME_CODE_POINTS = 12
const UNPAIRED_SURROGATE_PATTERN = /[\uD800-\uDFFF]/u

export type FirstCandidate =
  | { kind: 'recognized'; nickname: string }
  | { kind: 'rejected'; rejection: OcrNicknameRejection; text: string | null }

export type PartySlotRecognition =
  | { kind: 'missing'; slot: number }
  | { kind: 'failed'; slot: number; portrait: CharacterPortrait | null; prediction: null }
  | (FirstCandidate & {
      slot: number
      portrait: CharacterPortrait | null
      prediction: string | null
      legacyNickname: string
    })

/** 회차 프레임 하나의 모든 크롭을 확보한 뒤 슬롯 순서대로 인식하고 첫 후보를 판정한다. */
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
    let data: PartyOcrResult
    try {
      const result = await recognize(input.nickname)
      data = result.data
    } catch {
      results.push({ kind: 'failed', slot, portrait: input.portrait, prediction: null })
      continue
    }
    results.push({
      ...firstCandidate(data),
      slot,
      portrait: input.portrait,
      prediction: data.candidates[0]?.nickname ?? null,
      legacyNickname: normalizeNickname(data.text)
    })
  }

  return results
}

/**
 * 첫 후보의 앞뒤 공백만 제거하며 잘못된 후보를 낮은 순위의 이름으로 대체하지 않는다. 파티와 공대 캡처가 같은
 * 판정을 쓴다.
 */
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
