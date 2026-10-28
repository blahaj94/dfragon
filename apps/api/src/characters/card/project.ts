import { textOrNull } from '@dfragon/lib/utils/shape-check'
import type { CharacterCard, CharacterRole } from './types.js'

export interface CharacterCardSource {
  character: Record<string, unknown>
}

const awakeningPrefix = '眞'

const bufferJobs = new Set(['크루세이더', '인챈트리스', '패러메딕', '뮤즈'])

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

export function projectCharacterCard(details: CharacterCardSource): CharacterCard {
  const role = characterRole(details.character.jobGrowName)

  return { role, stats: null, score: null, serverRank: null, set: null, oath: null, investment: [] }
}
