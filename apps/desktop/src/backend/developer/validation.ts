import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS } from './image-limits'

/** Narrows a value to an integer that JavaScript can represent exactly. */
export function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

/** Checks image dimensions against the limits used by developer sample storage. */
export function isValidImageDimensions(width: unknown, height: unknown): boolean {
  return (
    isSafeInteger(width) &&
    isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_IMAGE_DIMENSION &&
    height <= MAX_IMAGE_DIMENSION &&
    width * height <= MAX_IMAGE_PIXELS
  )
}

/** Accepts only UTC timestamps in the canonical ISO format written by Date#toISOString. */
export function isCanonicalIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}
