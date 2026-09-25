import { randomUUID } from 'node:crypto'
import { PNG } from 'pngjs'
import type {
  DeveloperCollectionKind,
  DeveloperPartySlot
} from '../../preload/common/types/developer'
import { validatePartyFrame, type CapturedPartyFrame } from './collection-session'

/** Encodes one main-owned frame once so an auth retry keeps the same ID and bytes. */
export function createOcrUploadPayload(
  frame: CapturedPartyFrame,
  selected: DeveloperPartySlot[],
  kind: DeveloperCollectionKind
): { id: string; body: string } | null {
  validatePartyFrame(frame)
  const original = frame.original
  if (!original || original.rgba.length !== frame.width * frame.height * 4) {
    return null
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
