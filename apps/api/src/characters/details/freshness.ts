import type { CharacterApiResponse } from '../../database/schemas/character-api-responses.js'
import { characterDetailSections } from './sections.js'

export const CHARACTER_FRESHNESS_MS = 5 * 60_000

export function characterFreshness(rows: CharacterApiResponse[]) {
  const sections = new Set(rows.map((row) => row.section))
  if (
    rows.length !== characterDetailSections.length ||
    !characterDetailSections.every((section) => sections.has(section))
  ) {
    return null
  }
  // Every section must still be fresh. Changed-content timestamps are not fetch timestamps.
  const oldest = Math.min(...rows.map((row) => row.lastSuccessfulFetchAt.getTime()))
  if (!Number.isFinite(oldest)) {
    return null
  }
  return {
    lastSuccessfulFetchAt: new Date(oldest).toISOString(),
    expiresAt: new Date(oldest + CHARACTER_FRESHNESS_MS).toISOString()
  }
}
