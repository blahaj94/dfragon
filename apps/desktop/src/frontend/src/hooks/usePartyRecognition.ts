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
import { reportRendererDiagnostic } from '../lib/runtime-diagnostics'

const MAX_NICKNAME_CODE_POINTS = 12
const UNPAIRED_SURROGATE_PATTERN = /[\uD800-\uDFFF]/u
const PARTY_SAMPLE_SLOTS = [1, 2, 3, 4] as const

type OcrStability = { input: OcrCaptureObservation; reported: boolean }
export type RecognitionState = 'idle' | 'pending' | 'complete' | 'failure'

export function usePartyRecognition(
  observe: (input: { slot: number; nickname: string | null }) => void,
  observeOcr?: (input: OcrCaptureObservation) => void
): {
  stableNicknames: (string | null)[]
  recognitionStates: readonly RecognitionState[]
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
  const completedSlotsRef = useRef(new Set<number>())
  const uploadedSlotsRef = useRef(new Set<number>())
  const [recognitionStates, setRecognitionStates] = useState<RecognitionState[]>(
    Array.from({ length: PARTY_SLOT_COUNT }, () => 'idle')
  )
  const [stableNicknames, setStableNicknames] = useState<(string | null)[]>(emptySlots())

  function resetRecognition(): void {
    generationRef.current += 1
    completedSlotsRef.current.clear()
    uploadedSlotsRef.current.clear()
    setRecognitionStates(Array.from({ length: PARTY_SLOT_COUNT }, () => 'idle'))
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
      if (captured == null && !completedSlotsRef.current.has(slot)) {
        clearRecognitionSlot(slot)
      }
    }
    for (const [slot, captured] of inputs.entries()) {
      if (signal.aborted || generation !== generationRef.current) {
        return
      }

      if (captured == null || completedSlotsRef.current.has(slot)) {
        continue
      }
      setRecognitionState(slot, 'pending')
      let prediction: string | null = null
      let result: { data: PartyOcrResult }
      try {
        result = await worker.recognize(captured.nickname)
        prediction = result.data.candidates[0]?.nickname ?? null
      } finally {
        if (
          !signal.aborted &&
          generation === generationRef.current &&
          !uploadedSlotsRef.current.has(slot)
        ) {
          uploadedSlotsRef.current.add(slot)
          if (frame !== null && frame.captureId !== undefined && frame.frameId !== undefined) {
            void window.ocrCollection
              .collectOcrSample({
                captureId: frame.captureId,
                frameId: frame.frameId,
                slot: PARTY_SAMPLE_SLOTS[slot],
                prediction
              })
              .then((result) => {
                if (result.status === 'failed') {
                  reportRendererDiagnostic('UPLOAD_FAILED')
                }
              })
              .catch(() => reportRendererDiagnostic('UPLOAD_FAILED'))
          }
        }
      }
      if (signal.aborted || generation !== generationRef.current) {
        return
      }
      const nickname = firstCandidateName(result.data)
      if (nickname === null) {
        completedSlotsRef.current.add(slot)
        setRecognitionState(slot, 'failure')
        notify({ slot, nickname: '', candidateNicknames: [''], portrait: captured.portrait })
        continue
      }
      const input: OcrCaptureObservation = {
        slot,
        nickname,
        candidateNicknames: [nickname],
        portrait: captured.portrait
      }
      const previous = ocrStabilityRef.current[slot]
      const sameInput = previous != null && sameOcrSearchInput(previous.input, input)
      if (previous == null || !sameInput) {
        ocrStabilityRef.current[slot] = { input, reported: false }
        setStableSlot(slot, null)
        continue
      }

      if (!previous.reported) {
        notify(input)
      }
      ocrStabilityRef.current[slot] = { input, reported: true }
      completedSlotsRef.current.add(slot)
      setRecognitionState(slot, 'complete')
      setStableSlot(slot, input.nickname)
    }
  }

  function clearRecognitionSlot(slot: number): void {
    const hadReported =
      reportedNicknamesRef.current[slot] != null || ocrStabilityRef.current[slot]?.reported === true
    slotStabilityRef.current[slot] = null
    reportedNicknamesRef.current[slot] = null
    ocrStabilityRef.current[slot] = null
    setRecognitionState(slot, 'idle')
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

  function setRecognitionState(slot: number, state: RecognitionState): void {
    setRecognitionStates((previous) => {
      if (previous[slot] === state) {
        return previous
      }
      const next = previous.slice()
      next[slot] = state

      return next
    })
  }

  return { stableNicknames, recognitionStates, recognizePartyNicknames, resetRecognition }
}

/** 첫 후보의 앞뒤 공백만 제거하며, 비어 있거나 잘못됐어도 낮은 순위의 이름으로 대체하지 않는다. */
function firstCandidateName(result: PartyOcrResult): string | null {
  const text = result.candidates[0]?.nickname
  if (text == null) {
    return null
  }
  const nickname = text.trim()
  const length = [...nickname].length
  if (
    length === 0 ||
    length > MAX_NICKNAME_CODE_POINTS ||
    UNPAIRED_SURROGATE_PATTERN.test(nickname)
  ) {
    return null
  }

  return nickname
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
