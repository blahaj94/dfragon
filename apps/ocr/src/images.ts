import { PNG } from 'pngjs'
import { OcrError } from './errors.js'
import { parseInputRecord } from './input.js'
import type { Capture, Crop } from './model.js'

export const MAX_PNG_BYTES = 16 * 1024 * 1024

export function decodePng(bytes: Buffer): PNG {
  if (
    bytes.length < 33 ||
    bytes.length > MAX_PNG_BYTES ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new OcrError('INVALID_INPUT')
  }
  // pngjs accepts duplicate IHDR and uses an unbounded inflater for interlaced PNGs.
  // Capture uploads use ordinary non-interlaced PNG; reject both before decoding.
  if (
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString('ascii', 12, 16) !== 'IHDR' ||
    bytes[28] !== 0
  ) {
    throw new OcrError('INVALID_INPUT')
  }
  let offset = 8
  let ended = false
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      throw new OcrError('INVALID_INPUT')
    }
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    if (offset + length + 12 > bytes.length || (type === 'IHDR' && offset !== 8)) {
      throw new OcrError('INVALID_INPUT')
    }
    offset += length + 12
    if (type === 'IEND') {
      if (length !== 0 || offset !== bytes.length) {
        throw new OcrError('INVALID_INPUT')
      }
      ended = true
    }
  }
  if (!ended) {
    throw new OcrError('INVALID_INPUT')
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width === 0 || height === 0 || width > 8192 || height > 8192 || width * height > 16_777_216) {
    throw new OcrError('INVALID_INPUT')
  }
  try {
    return PNG.sync.read(bytes, { checkCRC: true })
  } catch {
    throw new OcrError('INVALID_INPUT')
  }
}

function parseCoordinate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new OcrError('INVALID_INPUT')
  }
  return value
}

export function parseUpload(value: unknown): { capture: Capture; png: Buffer } {
  const body = parseInputRecord(value)
  if (
    typeof body.originalPng !== 'string' ||
    body.originalPng.length > Math.ceil(MAX_PNG_BYTES / 3) * 4
  ) {
    throw new OcrError('INVALID_INPUT')
  }
  const png = Buffer.from(body.originalPng, 'base64')
  if (png.toString('base64') !== body.originalPng) {
    throw new OcrError('INVALID_INPUT')
  }
  const decoded = decodePng(png)
  const { id, capturedAt, kind, uiScale, uiScaleSource } = body
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  ) {
    throw new OcrError('INVALID_INPUT')
  }

  if (
    typeof capturedAt !== 'string' ||
    !Number.isFinite(Date.parse(capturedAt)) ||
    new Date(capturedAt).toISOString() !== capturedAt
  ) {
    throw new OcrError('INVALID_INPUT')
  }

  if (
    (kind !== 'hud' && kind !== 'participants') ||
    (uiScale !== null &&
      (typeof uiScale !== 'number' || !Number.isFinite(uiScale) || uiScale <= 0 || uiScale > 10)) ||
    typeof uiScaleSource !== 'string' ||
    (uiScaleSource !== 'game' && uiScaleSource !== 'estimated' && uiScaleSource !== 'unknown') ||
    (uiScale === null) !== (uiScaleSource === 'unknown')
  ) {
    throw new OcrError('INVALID_INPUT')
  }

  if (!Array.isArray(body.crops) || body.crops.length < 1 || body.crops.length > 4) {
    throw new OcrError('INVALID_INPUT')
  }
  const slots = new Set<number>()
  const crops = body.crops
    .map((value: unknown): Crop => {
      const crop = parseInputRecord(value)
      const slot = parseCoordinate(crop.slot)
      const x = parseCoordinate(crop.x)
      const y = parseCoordinate(crop.y)
      const width = parseCoordinate(crop.width)
      const height = parseCoordinate(crop.height)
      if (
        slot < 1 ||
        slot > 4 ||
        slots.has(slot) ||
        x < 0 ||
        y < 0 ||
        width < 1 ||
        height < 1 ||
        x + width > decoded.width ||
        y + height > decoded.height
      ) {
        throw new OcrError('INVALID_INPUT')
      }
      slots.add(slot)
      return { slot, x, y, width, height }
    })
    .sort((a, b) => a.slot - b.slot)
  return {
    png,
    capture: {
      id,
      capturedAt,
      kind,
      width: decoded.width,
      height: decoded.height,
      uiScale,
      uiScaleSource,
      crops
    }
  }
}

export function cropPng(original: PNG, crop: Crop): Buffer {
  const output = new PNG({ width: crop.width, height: crop.height })
  PNG.bitblt(original, output, crop.x, crop.y, crop.width, crop.height, 0, 0)
  return PNG.sync.write(output)
}
