import { useRef, useState } from 'react'
import type { PartyOcrWorker, PartyOcrResult, SlotStability } from '../types/capture'
import {
  capturePartyNicknameCrops,
  capturePartyRecognitionInputs,
  type PartyFrameSource
} from '../lib/party'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import { normalizeNickname, updateSlotStability } from '../lib/recognition'
import type { OcrCaptureObservation } from '../lib/capture-search'
import { sameOcrSearchInput } from '../../../preload/common/search/ocr-input'

const MAX_OCR_CANDIDATE_COUNT = 2
const MAX_NICKNAME_CODE_POINTS = 12
const UNPAIRED_SURROGATE_PATTERN = /[\uD800-\uDFFF]/u

type OcrStability = { input: OcrCaptureObservation; reported: boolean }

export function usePartyRecognition(
  observe: (input: { slot: number; nickname: string | null }) => void,
  observeOcr?: (input: OcrCaptureObservation) => void
): {
  stableNicknames: (string | null)[]
  recognizePartyNicknames: (
    frame: PartyFrameSource,
    worker: PartyOcrWorker,
    signal: AbortSignal
  ) => Promise<void>
  resetRecognition: () => void
} {
  const slotStabilityRef = useRef<(SlotStability | null)[]>(emptyStabilitySlots())
  const reportedNicknamesRef = useRef<(string | null)[]>(emptySlots())
  const stableNicknamesRef = useRef<(string | null)[]>(emptySlots())
  const ocrStabilityRef = useRef<(OcrStability | null)[]>(emptyOcrSlots())
  const generationRef = useRef(0)
  const [stableNicknames, setStableNicknames] = useState<(string | null)[]>(emptySlots())

  function resetRecognition(): void {
    generationRef.current += 1
    ocrStabilityRef.current = emptyOcrSlots()
    slotStabilityRef.current = emptyStabilitySlots()
    reportedNicknamesRef.current = emptySlots()
    stableNicknamesRef.current = emptySlots()
    setStableNicknames(emptySlots())
  }

  async function recognizePartyNicknames(
    frame: PartyFrameSource,
    worker: PartyOcrWorker,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) {
      return
    }

    if (observeOcr != null) {
      await recognizeOcrInputs(frame, worker, signal, observeOcr)

      return
    }
    const generation = generationRef.current
    const crops = capturePartyNicknameCrops(frame)
    // 같은 프레임에서 사라진 슬롯은 다른 슬롯의 OCR 완료를 기다리지 않는다.
    for (const [slot, crop] of crops.entries()) {
      if (crop == null) {
        clearRecognitionSlot(slot)
      }
    }
    const nextStableNicknames = stableNicknamesRef.current.slice()
    for (const [slot, crop] of crops.entries()) {
      if (signal.aborted || generation !== generationRef.current) {
        return
      }

      if (crop == null) {
        continue
      }
      const nickname = normalizeNickname((await worker.recognize(crop)).data.text)
      if (signal.aborted || generation !== generationRef.current) {
        return
      }
      const recognizedNickname = nickname.length > 0 ? nickname : null
      const stability = updateSlotStability(slotStabilityRef.current[slot], recognizedNickname)
      slotStabilityRef.current[slot] = stability
      const hasStableNickname = stability.stableNickname != null
      if (!hasStableNickname) {
        const hadReportedNickname = reportedNicknamesRef.current[slot] != null
        if (hadReportedNickname) {
          observe({ slot, nickname: null })
        }
        reportedNicknamesRef.current[slot] = null
        nextStableNicknames[slot] = null
        continue
      }
      nextStableNicknames[slot] = stability.stableNickname
      const isNewStableNickname = reportedNicknamesRef.current[slot] !== stability.stableNickname
      if (isNewStableNickname) {
        observe({ nickname: stability.stableNickname, slot })
        reportedNicknamesRef.current[slot] = stability.stableNickname
      }
    }
    const hasChangedNicknames = nextStableNicknames.some((nickname, slot) => {
      const hasChanged = nickname !== stableNicknamesRef.current[slot]

      return hasChanged
    })
    if (hasChangedNicknames) {
      stableNicknamesRef.current = nextStableNicknames
      setStableNicknames(nextStableNicknames)
    }
  }

  async function recognizeOcrInputs(
    frame: PartyFrameSource,
    worker: PartyOcrWorker,
    signal: AbortSignal,
    notify: (input: OcrCaptureObservation) => void
  ): Promise<void> {
    const generation = generationRef.current
    const inputs = capturePartyRecognitionInputs(frame)
    for (const [slot, captured] of inputs.entries()) {
      if (captured == null) {
        clearRecognitionSlot(slot)
      }
    }
    for (const [slot, captured] of inputs.entries()) {
      if (signal.aborted || generation !== generationRef.current) {
        return
      }

      if (captured == null) {
        continue
      }
      const result = await worker.recognize(captured.nickname)
      if (signal.aborted || generation !== generationRef.current) {
        return
      }
      const candidateNicknames = candidateNames(result.data)
      const nickname = candidateNicknames[0]
      let input: OcrCaptureObservation | null = null
      if (nickname != null) {
        input = { slot, nickname, candidateNicknames, portrait: captured.portrait }
      }
      const previous = ocrStabilityRef.current[slot]
      const sameInput =
        input != null && previous != null && sameOcrSearchInput(previous.input, input)
      if (input == null || previous == null || !sameInput) {
        if (previous?.reported) {
          observe({ slot, nickname: null })
        }
        ocrStabilityRef.current[slot] = input == null ? null : { input, reported: false }
        setStableSlot(slot, null)
        continue
      }

      if (!previous.reported) {
        notify(input)
      }
      ocrStabilityRef.current[slot] = { input, reported: true }
      setStableSlot(slot, input.nickname)
    }
  }

  function clearRecognitionSlot(slot: number): void {
    const hadReported =
      reportedNicknamesRef.current[slot] != null || ocrStabilityRef.current[slot]?.reported === true
    slotStabilityRef.current[slot] = null
    reportedNicknamesRef.current[slot] = null
    ocrStabilityRef.current[slot] = null
    setStableSlot(slot, null)
    if (hadReported) {
      observe({ slot, nickname: null })
    }
  }

  function setStableSlot(slot: number, nickname: string | null): void {
    if (stableNicknamesRef.current[slot] === nickname) {
      return
    }
    const next = stableNicknamesRef.current.slice()
    next[slot] = nickname
    stableNicknamesRef.current = next
    setStableNicknames(next)
  }

  return { stableNicknames, recognizePartyNicknames, resetRecognition }
}

/** OCR 순위를 유지하며 검색 계약을 벗어난 이름과 중복만 제외한다. 글자와 점수는 보정하지 않는다. */
function candidateNames(result: PartyOcrResult): string[] {
  const names: string[] = []
  for (const { nickname } of result.candidates) {
    const length = [...nickname].length
    if (
      length === 0 ||
      length > MAX_NICKNAME_CODE_POINTS ||
      nickname !== nickname.trim() ||
      UNPAIRED_SURROGATE_PATTERN.test(nickname) ||
      names.includes(nickname)
    ) {
      continue
    }
    names.push(nickname)
    if (names.length === MAX_OCR_CANDIDATE_COUNT) {
      break
    }
  }

  return names
}

function emptyOcrSlots(): (OcrStability | null)[] {
  return Array.from({ length: PARTY_SLOT_COUNT }, () => null)
}

function emptySlots(): (string | null)[] {
  return Array.from({ length: PARTY_SLOT_COUNT }, () => null)
}

function emptyStabilitySlots(): (SlotStability | null)[] {
  return Array.from({ length: PARTY_SLOT_COUNT }, () => null)
}
