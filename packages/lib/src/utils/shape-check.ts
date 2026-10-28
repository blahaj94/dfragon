/**
 * Runtime shape checks for values that cross a trust boundary without a schema library, such as
 * IPC results read in a sandboxed Electron preload. Every check is pure, never coerces, and only
 * answers whether the value already has the expected shape.
 */
export type ShapeCheck = (value: unknown) => boolean

const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/
const OFFSET_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function hasExactKeys(
  value: unknown,
  keys: readonly string[]
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false
  }

  return (
    Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  )
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

export function isNonblankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function textOrNull(value: unknown): string | null {
  if (isNonblankString(value)) {
    return value
  }

  return null
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/**
 * A UTC ISO 8601 timestamp (`Z` suffix, optional seconds and fraction) naming a real calendar
 * instant, so `2026-02-30T00:00Z` and `24:00` are rejected rather than rolled over.
 */
export function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !UTC_TIMESTAMP_PATTERN.test(value)) {
    return false
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) {
    return false
  }

  const secondsBoundary = value[16] === ':' ? 19 : 16

  return parsed.toISOString().slice(0, secondsBoundary) === value.slice(0, secondsBoundary)
}

export function isOffsetTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    OFFSET_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

export function nullable(check: ShapeCheck): ShapeCheck {
  return (value) => value === null || check(value)
}

export function oneOf(...values: readonly unknown[]): ShapeCheck {
  return (value) => values.includes(value)
}

export function listOf(check: ShapeCheck): ShapeCheck {
  return (value) => Array.isArray(value) && value.every(check)
}

export function exactObject(shape: Readonly<Record<string, ShapeCheck>>): ShapeCheck {
  const keys = Object.keys(shape)

  return (value) => hasExactKeys(value, keys) && keys.every((key) => shape[key](value[key]))
}
