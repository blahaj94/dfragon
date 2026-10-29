/**
 * Runtime shape checks for values that cross a trust boundary, such as IPC results read in a
 * sandboxed Electron preload. Every check is pure, never coerces, and only answers whether the
 * value already has the expected shape.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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
