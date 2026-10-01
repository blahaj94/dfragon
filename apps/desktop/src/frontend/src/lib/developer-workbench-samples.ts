import { filter, pipe, sort } from 'remeda'
import type { DeveloperWorkbenchSample } from './developer-party'

export type DeveloperLabelFilter = 'unlabeled' | 'complete' | 'excluded'

/** Sort the source's chosen split once, then select the label states shown in the workbench. */
export function queryDeveloperWorkbenchSamples({
  samples,
  source,
  split,
  labelFilter
}: {
  samples: readonly DeveloperWorkbenchSample[]
  source: 'local' | 'ocr'
  split: string
  labelFilter: DeveloperLabelFilter
}): {
  splitSamples: DeveloperWorkbenchSample[]
  visibleSamples: DeveloperWorkbenchSample[]
} {
  const splitSamples = pipe(
    samples,
    sort(compareWorkbenchSamples),
    filter((sample) => source !== 'ocr' || split === 'all' || sample.remote?.split === split)
  )
  const visibleSamples = filter(splitSamples, (sample) => matchesLabelFilter(sample, labelFilter))

  return { splitSamples, visibleSamples }
}

/** Evaluate the chosen split regardless of the displayed label filter or page; OCR requires answers. */
export function selectDeveloperEvaluationSamples(
  samples: readonly DeveloperWorkbenchSample[],
  source: 'local' | 'ocr'
): DeveloperWorkbenchSample[] {

  return filter(
    samples,
    (sample) => sample.excluded !== true && (source !== 'ocr' || sample.text != null)
  )
}

/** Select within the current page, but retain each image's number in the full chosen split. */
export function selectDeveloperWorkbenchSample({
  splitSamples,
  pageSamples,
  selectedId
}: {
  splitSamples: readonly DeveloperWorkbenchSample[]
  pageSamples: readonly DeveloperWorkbenchSample[]
  selectedId: string | null
}): { selected: DeveloperWorkbenchSample | null; selectedNumber: number } {
  const selected = pageSamples.find((sample) => sample.id === selectedId) ?? pageSamples[0] ?? null
  const selectedNumber =
    selected == null ? 0 : splitSamples.findIndex((sample) => sample.id === selected.id) + 1

  return { selected, selectedNumber }
}

/** Find the next visible image before saving; wrap around without selecting the current image. */
export function nextDeveloperWorkbenchSampleId(
  samples: readonly DeveloperWorkbenchSample[],
  currentId: string
): string | null {
  const others = filter(samples, (sample) => sample.id !== currentId)
  if (others.length === 0) {

    return null
  }

  const index = samples.findIndex((sample) => sample.id === currentId)
  const nextId = samples.slice(index + 1).find((sample) => sample.id !== currentId)?.id
  if (nextId != null) {

    return nextId
  }

  return others[0].id
}

/** Preserve chronological order and compare party slots only when both samples have a source. */
function compareWorkbenchSamples(
  left: DeveloperWorkbenchSample,
  right: DeveloperWorkbenchSample
): number {
  const timeOrder = left.createdAt.localeCompare(right.createdAt)
  if (timeOrder !== 0) {

    return timeOrder
  }

  if (left.source != null && right.source != null && left.source.slot !== right.source.slot) {

    return left.source.slot - right.source.slot
  }

  return left.id.localeCompare(right.id)
}

/** Keep explicitly empty answers complete while separating excluded images from both label states. */
function matchesLabelFilter(
  sample: DeveloperWorkbenchSample,
  labelFilter: DeveloperLabelFilter
): boolean {
  if (labelFilter === 'excluded') {

    return sample.excluded === true
  }
  if (sample.excluded === true) {

    return false
  }
  if (labelFilter === 'unlabeled') {

    return sample.text == null
  }

  return sample.text != null
}
