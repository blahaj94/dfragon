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

export function parseDiagnosticEntry(value: unknown): DiagnosticEntry | null {
  if (
    value == null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== 3 ||
    !('sequence' in value) ||
    typeof value.sequence !== 'number' ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 1 ||
    !('timestamp' in value) ||
    typeof value.timestamp !== 'number' ||
    !Number.isSafeInteger(value.timestamp) ||
    value.timestamp < 0 ||
    !('code' in value) ||
    !isDiagnosticCode(value.code)
  ) {
    return null
  }

  return { sequence: value.sequence, timestamp: value.timestamp, code: value.code }
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
