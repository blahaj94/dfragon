import { describe, expect, it } from 'vitest'
import type { DeveloperWorkbenchSample } from './developer-party'
import {
  nextDeveloperWorkbenchSampleId,
  queryDeveloperWorkbenchSamples,
  selectDeveloperEvaluationSamples,
  selectDeveloperWorkbenchSample
} from './developer-workbench-samples'

const localQuery = { source: 'local', split: 'all', labelFilter: 'complete' } as const

function sample(
  id: string,
  overrides: Partial<DeveloperWorkbenchSample> = {}
): DeveloperWorkbenchSample {

  return {
    id,
    createdAt: '2026-09-25T00:00:00.000Z',
    width: 100,
    height: 36,
    text: '정답',
    source: null,
    excluded: false,
    ...overrides
  }
}

const slotSource = (slot: 1 | 2): NonNullable<DeveloperWorkbenchSample['source']> => ({
  slot,
  frameWidth: 1920,
  frameHeight: 1080,
  scale: 1
})

describe('workbench sample query', () => {
  it('sorts chronologically without changing the input array or sample identities', () => {
    const early = Object.freeze(sample('z-early'))
    const late = Object.freeze(sample('a-late', { createdAt: '2026-09-26T00:00:00.000Z' }))
    const samples = Object.freeze([late, early])

    const lists = queryDeveloperWorkbenchSamples({ ...localQuery, samples })

    expect(lists.visibleSamples).toEqual([early, late])
    expect(lists.visibleSamples[0]).toBe(early)
    expect(lists.visibleSamples[1]).toBe(late)
    expect(samples).toEqual([late, early])
  })

  it('uses party slot order only when both sources exist, otherwise falls back to IDs', () => {
    const slotTwo = sample('a', { source: slotSource(2) })
    const slotOne = sample('z', { source: slotSource(1) })
    const sameSlot = sample('b', { source: slotSource(2) })
    const oldSample = sample('m')

    expect(
      queryDeveloperWorkbenchSamples({ ...localQuery, samples: [slotTwo, slotOne] }).visibleSamples
    ).toEqual([slotOne, slotTwo])
    expect(
      queryDeveloperWorkbenchSamples({ ...localQuery, samples: [sameSlot, slotTwo] }).visibleSamples
    ).toEqual([slotTwo, sameSlot])
    for (const samples of [
      [oldSample, slotOne],
      [slotOne, oldSample]
    ]) {
      expect(queryDeveloperWorkbenchSamples({ ...localQuery, samples }).visibleSamples).toEqual([
        oldSample,
        slotOne
      ])
    }
  })

  it.each([
    ['unlabeled', ['a-unlabeled']],
    ['complete', ['b-empty', 'c-complete']],
    ['excluded', ['d-excluded']]
  ] as const)('applies the %s label filter while retaining the full split', (labelFilter, ids) => {
    const samples = [
      sample('a-unlabeled', { text: null }),
      sample('b-empty', { text: '' }),
      sample('c-complete'),
      sample('d-excluded', { excluded: true })
    ]

    const lists = queryDeveloperWorkbenchSamples({ ...localQuery, samples, labelFilter })

    expect(lists.visibleSamples.map(({ id }) => id)).toEqual(ids)
    expect(lists.splitSamples).toEqual(samples)
  })

  it('limits OCR lists to the selected split and ignores that setting for local samples', () => {
    const test = sample('a-test', { remote: { kind: 'hud', split: 'test' } })
    const train = sample('b-train', { remote: { kind: 'hud', split: 'train' } })
    const samples = [test, train]

    expect(
      queryDeveloperWorkbenchSamples({ ...localQuery, samples, source: 'ocr', split: 'test' })
        .splitSamples
    ).toEqual([test])
    expect(
      queryDeveloperWorkbenchSamples({ ...localQuery, samples, split: 'test' }).splitSamples
    ).toEqual(samples)
  })
})

describe('evaluation targets', () => {
  it('includes unlabeled local images but requires saved OCR answers, including empty answers', () => {
    const unlabeled = sample('unlabeled', { text: null })
    const empty = sample('empty', { text: '' })
    const completed = sample('completed')
    const excluded = sample('excluded', { excluded: true })
    const samples = [unlabeled, empty, completed, excluded]

    expect(selectDeveloperEvaluationSamples(samples, 'local')).toEqual([
      unlabeled,
      empty,
      completed
    ])
    expect(selectDeveloperEvaluationSamples(samples, 'ocr')).toEqual([empty, completed])
  })
})

describe('sample selection', () => {
  it('retains a visible selection and numbers it within the split, including hidden labels', () => {
    const hidden = sample('hidden', { text: null })
    const first = sample('first')
    const selected = sample('selected')

    const selection = selectDeveloperWorkbenchSample({
      splitSamples: [hidden, first, selected],
      pageSamples: [first, selected],
      selectedId: selected.id
    })

    expect(selection.selected).toBe(selected)
    expect(selection.selectedNumber).toBe(3)
  })

  it('falls back inside the current page and clears selection when that page is empty', () => {
    const previousPage = sample('previous')
    const currentPage = sample('current')
    const splitSamples = [previousPage, currentPage]

    expect(
      selectDeveloperWorkbenchSample({
        splitSamples,
        pageSamples: [currentPage],
        selectedId: previousPage.id
      })
    ).toEqual({ selected: currentPage, selectedNumber: 2 })
    expect(
      selectDeveloperWorkbenchSample({ splitSamples, pageSamples: [], selectedId: currentPage.id })
    ).toEqual({ selected: null, selectedNumber: 0 })
  })

  it('keeps an empty next ID instead of falling back to an earlier sample', () => {
    const samples = [sample('earlier'), sample('current'), sample('')]

    expect(nextDeveloperWorkbenchSampleId(samples, 'current')).toBe('')
  })

  it('advances within the visible list and wraps without selecting the current sample again', () => {
    const samples = [sample('first'), sample('second'), sample('third')]

    expect(nextDeveloperWorkbenchSampleId(samples, 'first')).toBe('second')
    expect(nextDeveloperWorkbenchSampleId(samples, 'third')).toBe('first')
    expect(nextDeveloperWorkbenchSampleId(samples, 'missing')).toBe('first')
    expect(nextDeveloperWorkbenchSampleId([samples[0]], 'first')).toBeNull()
    expect(nextDeveloperWorkbenchSampleId([], 'missing')).toBeNull()
  })
})
