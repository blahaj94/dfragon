type SourceWithId = {
  id: string
}

export function findSelectedSource<T extends SourceWithId>(
  sources: readonly T[],
  sourceId: string
): T | null {
  const selected = sources.find((source) => source.id === sourceId)
  if (selected != null) {
    return selected
  }

  return null
}
