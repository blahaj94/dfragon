// Provider JSONB is untrusted here: the card keeps only values Desktop can validate strictly.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function textOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value !== '') {
    return value
  }

  return null
}

export function finiteOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

export function records(value: unknown): Record<string, unknown>[] {
  const items = Array.isArray(value) ? value.filter(isRecord) : []

  return items
}
