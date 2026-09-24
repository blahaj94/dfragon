import type { DeveloperWorkbenchSample } from './developer-party'

// Keeps old samples chronological and each captured batch in party-slot order.
export function sortDeveloperWorkbenchSamples(
  samples: readonly DeveloperWorkbenchSample[]
): DeveloperWorkbenchSample[] {
  return [...samples].sort((left, right) => {
    const timeOrder = left.createdAt.localeCompare(right.createdAt)
    if (timeOrder !== 0) {
      return timeOrder
    }

    if (left.source != null && right.source != null && left.source.slot !== right.source.slot) {
      return left.source.slot - right.source.slot
    }

    return left.id.localeCompare(right.id)
  })
}
