export type NeopleStage = 'basic' | 'sections' | 'catalog'

export type RecordNeopleStage = (stage: NeopleStage, durationMs: number) => void

export interface NeopleStageTimings {
  record: RecordNeopleStage
  markShared(): void
}

export const ignoredNeopleStageTimings: NeopleStageTimings = {
  record: () => undefined,
  markShared: () => undefined
}

export function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt)
}
