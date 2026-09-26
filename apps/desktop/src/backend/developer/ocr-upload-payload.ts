import { randomUUID } from 'node:crypto'
import { PNG } from 'pngjs'
import type {
  DeveloperCollectionKind,
  DeveloperPartySlot
} from '../../preload/common/types/developer'
import { validatePartyFrame, type CapturedPartyFrame } from './collection-session'
import { isDeveloperPartySlot } from '../../preload/common/developer-collection'

/** Encodes one main-owned frame once so an auth retry keeps the same ID and bytes. */
export function createOcrUploadPayload(
  frame: CapturedPartyFrame,
  selected: DeveloperPartySlot[],
  kind: DeveloperCollectionKind
): { id: string; body: string } | null {
  validatePartyFrame(frame, kind)
  if (
    !Array.isArray(selected) ||
    new Set(selected).size !== selected.length ||
    [...selected].some((slot) => !isDeveloperPartySlot(slot, kind))
  ) {
    return null
  }
  const original = frame.original
  if (
    !original ||
    !Buffer.isBuffer(original.rgba) ||
    original.rgba.length !== frame.width * frame.height * 4 ||
    !Array.isArray(original.crops) ||
    original.crops.length !== frame.slots.length
  ) {
    return null
  }
  const seen = new Set<number>()
  for (const crop of original.crops) {
    if (
      crop == null ||
      !isDeveloperPartySlot(crop.slot, kind) ||
      seen.has(crop.slot) ||
      ![crop.x, crop.y, crop.width, crop.height].every(Number.isSafeInteger) ||
      crop.x < 0 ||
      crop.y < 0 ||
      crop.width < 1 ||
      crop.height < 1 ||
      crop.x + crop.width > frame.width ||
      crop.y + crop.height > frame.height ||
      !frame.slots.some(
        (slot) =>
          slot.slot === crop.slot && slot.width === crop.width && slot.height === crop.height
      )
    ) {
      return null
    }
    seen.add(crop.slot)
  }
  const crops = original.crops.filter(({ slot }) => selected.includes(slot))
  if (crops.length === 0) {
    return null
  }
  const image = new PNG({ width: frame.width, height: frame.height })
  image.data = original.rgba
  const png = PNG.sync.write(image)
  if (png.length > 16 * 1024 * 1024) {
    return null
  }
  const id = randomUUID()
  const body = JSON.stringify({
    id,
    capturedAt: frame.capturedAt,
    kind,
    originalPng: png.toString('base64'),
    uiScale: frame.scale,
    uiScaleSource: 'estimated',
    crops
  })
  return { id, body }
}
