/**
 * Runtime shape checks for values that cross a trust boundary without a schema library, such as
 * IPC results read in a sandboxed Electron preload. Every check is pure, never coerces, and only
 * answers whether the value already has the expected shape.
 */
export type ShapeCheck = (value: unknown) => boolean

const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/
const OFFSET_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/

/** A non-null object that is not an array. Its keys and prototype are not checked. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** A non-null, non-array object whose own keys, symbols included, are exactly `keys`. */
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

/** A number other than NaN and the infinities. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** null or a finite number. */
export function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

/** null or any string, the empty string included. */
export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/** A string with at least one non-whitespace character. */
export function isNonblankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** The string itself when it has a non-whitespace character, otherwise null. Never coerces. */
export function textOrNull(value: unknown): string | null {
  if (isNonblankString(value)) {
    return value
  }

  return null
}

/** A safe integer that is zero or greater. */
export function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** A safe integer that is one or greater. */
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

/** An ISO 8601 timestamp with a `Z` or `±HH:MM` offset that `Date.parse` accepts. */
export function isOffsetTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    OFFSET_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

/** Accepts null or whatever `check` accepts. */
export function nullable(check: ShapeCheck): ShapeCheck {
  return (value) => value === null || check(value)
}

/** Accepts only the listed values, compared with SameValueZero. */
export function oneOf(...values: readonly unknown[]): ShapeCheck {
  return (value) => values.includes(value)
}

/** Accepts an array whose every item `check` accepts, the empty array included. */
export function listOf(check: ShapeCheck): ShapeCheck {
  return (value) => Array.isArray(value) && value.every(check)
}

/** Accepts an object with exactly the keys of `shape`, each value accepted by its check. */
export function exactObject(shape: Readonly<Record<string, ShapeCheck>>): ShapeCheck {
  const keys = Object.keys(shape)

  return (value) => hasExactKeys(value, keys) && keys.every((key) => shape[key](value[key]))
}
