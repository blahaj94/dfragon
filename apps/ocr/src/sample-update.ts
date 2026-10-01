import { OCR_ERROR_CODE, OcrError } from './errors.js'
import type { Sample, Split } from './model.js'

export function planSampleSplit({
  previousSample,
  text,
  excluded,
  targetSplit,
  knownLabel,
  automaticSplitInitialized,
  confirmSplitChange
}: {
  previousSample: Pick<Sample, 'text' | 'split'>
  text: string | null
  excluded: boolean
  targetSplit: Split | undefined
  knownLabel: boolean
  automaticSplitInitialized: boolean
  confirmSplitChange: boolean
}) {
  const assignNew =
    text !== null &&
    !excluded &&
    targetSplit === undefined &&
    !knownLabel &&
    automaticSplitInitialized
  let nextSplit = targetSplit
  if (nextSplit === undefined) {
    nextSplit = assignNew ? 'train' : 'unassigned'
  }

  if (
    text !== previousSample.text &&
    previousSample.split !== 'unassigned' &&
    previousSample.split !== nextSplit &&
    !confirmSplitChange
  ) {
    throw new OcrError(OCR_ERROR_CODE.LABEL_SPLIT_CHANGE)
  }

  return { nextSplit, assignNew }
}
