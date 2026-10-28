import {
  DIAGNOSTIC_HISTORY_LIMIT,
  DIAGNOSTIC_MESSAGES,
  RENDERER_DIAGNOSTIC_CODES,
  type DiagnosticCode,
  type DiagnosticEntry,
  type RendererDiagnosticCode
} from './types/diagnostics'

export function isDiagnosticCode(value: unknown): value is DiagnosticCode {
  return typeof value === 'string' && Object.hasOwn(DIAGNOSTIC_MESSAGES, value)
}

export function isRendererDiagnosticCode(value: unknown): value is RendererDiagnosticCode {
  return RENDERER_DIAGNOSTIC_CODES.some((code) => code === value)
}

function hasExactFields<Field extends string>(
  value: unknown,
  fields: readonly Field[]
): value is Record<Field, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.ownKeys(value).length === fields.length &&
    fields.every((field) => field in value)
  )
}

function isSafeIntegerAtLeast(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min
}

export function parseDiagnosticEntry(value: unknown): DiagnosticEntry | null {
  if (!hasExactFields(value, ['sequence', 'timestamp', 'code'])) {
    return null
  }
  const { sequence, timestamp, code } = value
  if (!isSafeIntegerAtLeast(sequence, 1)) {
    return null
  }

  if (!isSafeIntegerAtLeast(timestamp, 0)) {
    return null
  }

  if (!isDiagnosticCode(code)) {
    return null
  }

  return { sequence, timestamp, code }
}

export function parseDiagnosticHistory(value: unknown): DiagnosticEntry[] | null {
  if (!Array.isArray(value) || value.length > DIAGNOSTIC_HISTORY_LIMIT) {
    return null
  }
  const entries: DiagnosticEntry[] = []
  let lastSequence = 0
  for (const item of value) {
    const entry = parseDiagnosticEntry(item)
    if (entry == null || entry.sequence <= lastSequence) {
      return null
    }
    entries.push(entry)
    lastSequence = entry.sequence
  }

  return entries
}
