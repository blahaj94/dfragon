import { DEVELOPER_ERROR_CODES } from '../../preload/common/developer-errors'
import type {
  DeveloperCollectionKind,
  DeveloperParticipantWindow,
  DeveloperPartySlot
} from '../../preload/common/types/developer'
import { captureParticipantWindow } from './participant-window'
import { detectPartyFrameGeometry, PartyFrameGeometryError } from '@dfragon/lib'
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS } from './persistence'
import type { CapturedPartyFrame } from './collection-session'
import {
  captureDnfClient,
  isCapturedRegionCovered,
  WINDOW_CAPTURE_ERRORS,
  assertDnfShortcutAccess as assertNativeShortcutAccess,
  assertShortcutProcessAccess as assertNativeProcessAccess,
  type ShortcutAccessApi
} from '../lib/win32-window-capture'
export {
  isDnfExecutablePath,
  isDnfForeground,
  partySlotCoverageIntersectsWindow
} from '../lib/win32-window-capture'
export type { ShortcutAccessApi } from '../lib/win32-window-capture'

export type PartyFrameSlot = {
  slot: DeveloperPartySlot
  width: number
  height: number
  rgba: Buffer
}

export type PartyFrameCapture = {
  width: number
  height: number
  scale: number
  capturedAt: string
  slots: PartyFrameSlot[]
  participantWindow?: DeveloperParticipantWindow
  original?: CapturedPartyFrame['original']
}

type DetectedPartySlot = {
  slot: 1 | 2 | 3 | 4
  x: number
  y: number
  width: number
  height: number
  coverage: { x: number; y: number; width: number; height: number }
}
/** Validates detector output without filling gaps between independently detected frames. */
export function hasValidDetectedPartySlots(
  value: unknown,
  frameWidth: number,
  frameHeight: number
): value is DetectedPartySlot[] {
  if (
    !Number.isSafeInteger(frameWidth) ||
    !Number.isSafeInteger(frameHeight) ||
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 4
  ) {
    return false
  }

  const seenSlots = new Set<number>()

  return value.every((candidate) => {
    if (candidate == null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return false
    }
    const slot = candidate as Record<string, unknown>
    const coverage = slot.coverage
    const slotNumber = slot.slot
    const cropX = slot.x
    const cropY = slot.y
    const cropWidth = slot.width
    const cropHeight = slot.height
    if (
      (slotNumber !== 1 && slotNumber !== 2 && slotNumber !== 3 && slotNumber !== 4) ||
      seenSlots.has(slotNumber) ||
      !Number.isSafeInteger(cropX) ||
      !Number.isSafeInteger(cropY) ||
      !Number.isSafeInteger(cropWidth) ||
      !Number.isSafeInteger(cropHeight) ||
      (cropX as number) < 0 ||
      (cropY as number) < 0 ||
      (cropWidth as number) <= 0 ||
      (cropHeight as number) <= 0 ||
      (cropX as number) + (cropWidth as number) > frameWidth ||
      (cropY as number) + (cropHeight as number) > frameHeight ||
      coverage == null ||
      typeof coverage !== 'object' ||
      Array.isArray(coverage)
    ) {
      return false
    }
    const visibleRegion = coverage as Record<string, unknown>
    const x = visibleRegion.x
    const y = visibleRegion.y
    const width = visibleRegion.width
    const height = visibleRegion.height
    if (
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      (x as number) < 0 ||
      (y as number) < 0 ||
      (width as number) <= 0 ||
      (height as number) <= 0 ||
      (x as number) + (width as number) > frameWidth ||
      (y as number) + (height as number) > frameHeight
    ) {
      return false
    }
    seenSlots.add(slotNumber)

    return true
  })
}

function cropSlot(
  frame: Buffer,
  frameWidth: number,
  slot: {
    slot: 1 | 2 | 3 | 4
    x: number
    y: number
    width: number
    height: number
  }
): PartyFrameSlot {
  const output = Buffer.allocUnsafe(slot.width * slot.height * 4)
  const rowBytes = slot.width * 4
  for (let row = 0; row < slot.height; row += 1) {
    const sourceStart = ((slot.y + row) * frameWidth + slot.x) * 4
    frame.copy(output, row * rowBytes, sourceStart, sourceStart + rowBytes)
  }

  return { slot: slot.slot, width: slot.width, height: slot.height, rgba: output }
}

function capturePartyFramePixels(kind: DeveloperCollectionKind): PartyFrameCapture {
  const frame = captureDnfClient()
  const { width, height, rgba, capturedAt } = frame
  if (kind === 'participants' || kind === 'raid') {
    const detected = captureParticipantWindow({ width, height, rgba }, capturedAt, kind)
    if (isCapturedRegionCovered(frame, detected.coverage)) {
      throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
    }

    return detected.frame
  }
  const { scale, slots } = detectPartyFrameGeometry({ width, height, rgba })
  if (!Number.isFinite(scale) || scale <= 0 || !hasValidDetectedPartySlots(slots, width, height)) {
    throw new Error(DEVELOPER_ERROR_CODES.PARTY_SLOTS_NOT_FOUND)
  }

  if (slots.some((slot) => isCapturedRegionCovered(frame, slot.coverage))) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }

  if (
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  const crops = slots.map(({ slot, x, y, width, height }) => ({ slot, x, y, width, height }))
  const original = { rgba, crops }
  const capturedSlots = slots.map((slot) => cropSlot(rgba, width, slot))

  return { width, height, scale, capturedAt, original, slots: capturedSlots }
}

function developerCaptureFailure(error: unknown): Error {
  if (error instanceof PartyFrameGeometryError) {
    return new Error(DEVELOPER_ERROR_CODES.PARTY_SLOTS_NOT_FOUND, { cause: error })
  }

  if (error instanceof Error) {
    if (error.message === WINDOW_CAPTURE_ERRORS.NOT_FOUND) {
      return new Error(DEVELOPER_ERROR_CODES.GAME_NOT_FOUND, { cause: error })
    }

    if (error.message === WINDOW_CAPTURE_ERRORS.ADMIN_REQUIRED) {
      return new Error(DEVELOPER_ERROR_CODES.ADMIN_REQUIRED, { cause: error })
    }

    if (error.message.startsWith('DEVELOPER_')) {
      return error
    }
  }

  return new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE, { cause: error })
}

/** 공통 Windows 캡처에서 얻은 한 프레임을 개발자 수집 형식으로 투영한다. */
export function capturePartyFrame(kind: DeveloperCollectionKind = 'hud'): PartyFrameCapture {
  try {
    return capturePartyFramePixels(kind)
  } catch (error) {
    throw developerCaptureFailure(error)
  }
}

/** 수집 단축키 등록에 필요한 프로세스 접근 실패를 개발자 오류로 정제한다. */
export function assertDnfShortcutAccess(): void {
  try {
    assertNativeShortcutAccess()
  } catch (error) {
    throw developerCaptureFailure(error)
  }
}

/** 네이티브 프로세스 접근 정책을 개발자 수집의 오류 계약으로 연결한다. */
export function assertShortcutProcessAccess(api: ShortcutAccessApi, gameProcessId: number): void {
  try {
    assertNativeProcessAccess(api, gameProcessId)
  } catch (error) {
    throw developerCaptureFailure(error)
  }
}
