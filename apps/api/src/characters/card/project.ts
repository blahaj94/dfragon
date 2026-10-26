import { textOrNull } from '@dfragon/lib/utils/shape-check'
import type { CharacterCard, CharacterRole } from './types.js'

// Only the stored section the card reads; projectCharacterDetails output satisfies this shape.
export interface CharacterCardSource {
  character: Record<string, unknown>
}

const awakeningPrefix = '眞'

// Every buffer advancement; names missing here are dealers.
const bufferJobs = new Set(['크루세이더', '인챈트리스', '패러메딕', '뮤즈'])

// The advancement name without the awakening prefix, e.g. '眞 뮤즈' -> '뮤즈'.
function baseJobGrowName(jobGrowName: unknown): string | null {
  const name = textOrNull(jobGrowName)
  if (name === null) {
    return null
  }

  if (!name.startsWith(awakeningPrefix)) {
    return name
  }

  return name.slice(awakeningPrefix.length).trim()
}

function characterRole(jobGrowName: unknown): CharacterRole | null {
  const job = baseJobGrowName(jobGrowName)
  if (job === null) {
    return null
  }

  if (bufferJobs.has(job)) {
    return 'buffer'
  }

  return 'dealer'
}

// Desktop main fills the score from the native engine; the API only decides the role.
export function projectCharacterCard(details: CharacterCardSource): CharacterCard {
  const role = characterRole(details.character.jobGrowName)

  return { role, stats: null, score: null, serverRank: null, set: null, oath: null, investment: [] }
}
