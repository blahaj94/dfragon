import { createHash } from 'node:crypto'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import { parseUpload } from './images.js'
import { parseInputRecord } from './input.js'
import type { Capture, Crop, TestCollection, TestCollectionSlot } from './model.js'

export const TEST_CAPTURE_PATH = '/api/desktop/test-captures'
const MAXIMUM_PREDICTION_LENGTH = 128

const UPLOAD_KEYS = [
  'id',
  'capturedAt',
  'kind',
  'uiScale',
  'uiScaleSource',
  'originalPng',
  'crops',
  'testCollection'
]
const CROP_KEYS = ['slot', 'x', 'y', 'width', 'height']
const COLLECTION_KEYS = ['trigger', 'slots']
const SLOT_KEYS = [...CROP_KEYS, 'prediction']

export function parseTestUploadEnabled(value: string | undefined): boolean {
  if (value === undefined || value === 'false') {
    return false
  }

  if (value !== 'true') {
    throw new Error('Invalid OCR configuration')
  }

  return true
}

export function isTestCaptureRequest(request: { method: string; originalUrl: string }): boolean {
  return request.method === 'POST' && request.originalUrl === TEST_CAPTURE_PATH
}

function rejectUnknownKeys(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
}

function containsNickname(slot: Crop, nickname: Crop): boolean {
  return (
    slot.x <= nickname.x &&
    slot.y <= nickname.y &&
    slot.x + slot.width >= nickname.x + nickname.width &&
    slot.y + slot.height >= nickname.y + nickname.height
  )
}

export function parseTestCapture(value: unknown): { capture: Capture; png: Buffer } {
  const body = parseInputRecord(value)
  rejectUnknownKeys(body, UPLOAD_KEYS)
  const collection = parseInputRecord(body.testCollection)
  rejectUnknownKeys(collection, COLLECTION_KEYS)
  if (body.kind !== 'hud' || (collection.trigger !== 'ocr' && collection.trigger !== 'shortcut')) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }

  if (!Array.isArray(body.crops)) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  const { capture, png } = parseUpload(body)
  for (const crop of body.crops) {
    rejectUnknownKeys(parseInputRecord(crop), CROP_KEYS)
  }

  if (!Array.isArray(collection.slots) || collection.slots.length !== capture.crops.length) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }

  const seen = new Set<number>()
  const slots = collection.slots
    .map((value: unknown): TestCollectionSlot => {
      const entry = parseInputRecord(value)
      rejectUnknownKeys(entry, SLOT_KEYS)
      const { slot, x, y, width, height, prediction } = entry
      if (
        typeof slot !== 'number' ||
        !Number.isSafeInteger(slot) ||
        seen.has(slot) ||
        typeof x !== 'number' ||
        !Number.isSafeInteger(x) ||
        x < 0 ||
        typeof y !== 'number' ||
        !Number.isSafeInteger(y) ||
        y < 0 ||
        typeof width !== 'number' ||
        !Number.isSafeInteger(width) ||
        width < 1 ||
        typeof height !== 'number' ||
        !Number.isSafeInteger(height) ||
        height < 1 ||
        x + width > capture.width ||
        y + height > capture.height ||
        (prediction !== null &&
          (typeof prediction !== 'string' || prediction.length > MAXIMUM_PREDICTION_LENGTH)) ||
        (collection.trigger === 'shortcut' && prediction !== null)
      ) {
        throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
      }
      const nickname = capture.crops.find((crop) => crop.slot === slot)
      const context = { slot, x, y, width, height }
      if (nickname === undefined || !containsNickname(context, nickname)) {
        throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
      }
      seen.add(slot)

      return { ...context, prediction }
    })
    .sort((a, b) => a.slot - b.slot)
  const rectangles = slots.map(({ slot, x, y, width, height }) => ({ slot, x, y, width, height }))
  // Repeated OCR rounds with identical pixels and geometry do not multiply dataset entries.
  const contentSha256 = createHash('sha256')
    .update(png)
    .update(JSON.stringify({ crops: capture.crops, slots: rectangles }))
    .digest('hex')
  const testCollection: TestCollection = { trigger: collection.trigger, slots, contentSha256 }
  const result: Capture = { ...capture, testCollection }

  return { capture: result, png }
}
