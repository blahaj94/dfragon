import { isFiniteNumber, isRecord } from '@dfragon/lib/utils/shape-check'

// Provider JSONB is untrusted here: the card keeps only values Desktop can validate strictly.

export function textOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value !== '') {
    return value
  }

  return null
}

export function finiteOrNull(value: unknown): number | null {
  if (isFiniteNumber(value)) {
    return value
  }

  return null
}

export function records(value: unknown): Record<string, unknown>[] {
  const items = Array.isArray(value) ? value.filter(isRecord) : []

  return items
}
