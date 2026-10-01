import { OCR_ERROR_CODE, OcrError } from './errors.js'
import { decodeUploadedPng, parseImageIdentity } from './images.js'
import { parseInputRecord, parseLabel } from './input.js'
import type { Capture, SyntheticRendering } from './model.js'

function parseRgb(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)
  ) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }

  return value
}

export function parseSyntheticUpload(value: unknown): { capture: Capture; png: Buffer } {
  const body = parseInputRecord(value)
  if (
    Object.keys(body).some(
      (key) => !['id', 'generatedAt', 'png', 'text', 'rendering'].includes(key)
    )
  ) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  const { id, capturedAt } = parseImageIdentity(body.id, body.generatedAt)
  const text = parseLabel(body.text)
  const rendering = parseInputRecord(body.rendering)
  if (
    text === null ||
    /\s/u.test(text) ||
    typeof rendering.rendererVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(rendering.rendererVersion) ||
    rendering.rendererVersion.length > 32 ||
    (rendering.profile !== 'dotum' && rendering.profile !== 'nanum-neo') ||
    typeof rendering.scale !== 'number' ||
    !Number.isFinite(rendering.scale) ||
    rendering.scale <= 0 ||
    rendering.scale > 16 ||
    Object.keys(rendering).some(
      (key) =>
        !['rendererVersion', 'profile', 'scale', 'foregroundRgb', 'backgroundRgb'].includes(key)
    )
  ) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  const parsedRendering: SyntheticRendering = {
    rendererVersion: rendering.rendererVersion,
    profile: rendering.profile,
    scale: rendering.scale,
    foregroundRgb: parseRgb(rendering.foregroundRgb),
    backgroundRgb: parseRgb(rendering.backgroundRgb)
  }
  const { png, decoded } = decodeUploadedPng(body.png)
  // The renderer emits transparent glyphs; training needs the composited background pixels.
  for (let offset = 3; offset < decoded.data.length; offset += 4) {
    if (decoded.data[offset] !== 255) {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }
  }

  return {
    png,
    capture: {
      id,
      capturedAt,
      kind: 'synthetic',
      width: decoded.width,
      height: decoded.height,
      uiScale: null,
      uiScaleSource: 'unknown',
      crops: [{ slot: 1, x: 0, y: 0, width: decoded.width, height: decoded.height }],
      synthetic: { text, rendering: parsedRendering }
    }
  }
}
