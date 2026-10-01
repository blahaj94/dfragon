import { filter, groupBy, map, mapToObj, pipe, sort, sum, uniqueBy } from 'remeda'
import { OcrError, OCR_ERROR_CODE } from './errors.js'
import { parseInputRecord } from './input.js'
import {
  assignedSplits,
  characterGroups,
  type AssignedSplit,
  type CharacterGroup,
  type Split
} from './model.js'

export type SplitOptions = { ratios: Record<AssignedSplit, number>; replaceExisting: boolean }
export type SplitRow = { id: string; text: string | null; excluded: boolean; split: Split }
type LabeledRow = SplitRow & { text: string }
type NicknameGroup = { text: string; split: Split; features: Map<string, number> }

export function characterGroup(char: string): CharacterGroup {
  if (/\p{Script=Hangul}/u.test(char)) {

    return 'hangul'
  }
  if (/\p{Script=Hiragana}/u.test(char)) {

    return 'hiragana'
  }
  if (/\p{Script=Katakana}/u.test(char)) {

    return 'katakana'
  }
  if (/\p{Script=Han}/u.test(char)) {

    return 'hanja'
  }
  if (/\p{Script=Latin}/u.test(char)) {

    return 'latin'
  }
  if (/\p{Number}/u.test(char)) {

    return 'digit'
  }
  if (/[\p{Punctuation}\p{Symbol}]/u.test(char)) {

    return 'special'
  }

  return 'other'
}

export function parseSplitOptions(value: unknown): SplitOptions {
  const body = parseInputRecord(value)
  const ratios = parseInputRecord(body.ratios)
  if (
    typeof body.replaceExisting !== 'boolean' ||
    Object.keys(ratios).length !== 3 ||
    assignedSplits.some(
      (split) =>
        typeof ratios[split] !== 'number' ||
        !Number.isFinite(ratios[split]) ||
        Number(ratios[split]) < 0 ||
        Number(ratios[split]) > 100
    ) ||
    Math.abs(assignedSplits.reduce((sum, split) => sum + Number(ratios[split]), 0) - 100) > 1e-6
  ) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }

  return { ratios: ratios as SplitOptions['ratios'], replaceExisting: body.replaceExisting }
}

function distribution(rows: LabeledRow[]) {
  const groups = mapToObj(characterGroups, (group) => [group, 0])
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const char of row.text) {
      groups[characterGroup(char)]++
      counts.set(char, (counts.get(char) ?? 0) + 1)
    }
  }
  const images = rows.length
  const nicknames = uniqueBy(rows, (row) => row.text).length
  const characters = sum([...counts.values()])
  const frequencies = pipe(
    [...counts],
    sort((a, b) => {
      const countDifference = b[1] - a[1]
      if (countDifference) {

        return countDifference
      }

      return compareText(a[0], b[0])
    }),
    map(([character, count]) => {
      const group = characterGroup(character)

      return { character, count, group }
    })
  )

  return { images, nicknames, characters, groups, frequencies }
}

function compareText(a: string, b: string) {
  if (a < b) {

    return -1
  }
  if (a > b) {

    return 1
  }

  return 0
}

export function splitStatistics(rows: SplitRow[]) {
  const eligible = filter(rows, (row): row is LabeledRow => row.text !== null && !row.excluded)
  const bySplit = groupBy(eligible, (row) => row.split)
  const forSplit = (split: Split) => {
    const splitRows = bySplit[split] ?? []

    return distribution(splitRows)
  }
  const total = distribution(eligible)
  const train = forSplit('train')
  const val = forSplit('val')
  const test = forSplit('test')
  const unassigned = forSplit('unassigned')
  const skipped = rows.length - eligible.length

  return { total, splits: { train, val, test, unassigned }, skipped }
}

/** Greedy stratification with bounded local improvement; rare characters are soft objectives. */
export function planSplits(
  rows: SplitRow[],
  options: SplitOptions,
  manuallyUnassignedNicknames: readonly string[] = [],
  trainOnlyNicknames: readonly string[] = []
) {
  const eligible = filter(rows, (row): row is LabeledRow => row.text !== null && !row.excluded)
  if (eligible.length === 0) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  const protectedNicknames = new Set(
    manuallyUnassignedNicknames.map((text) => text.normalize('NFC'))
  )
  const trainOnly = new Set(trainOnlyNicknames.map((text) => text.normalize('NFC')))
  const groups = new Map<string, NicknameGroup>()
  for (const row of eligible) {
    const text = row.text.normalize('NFC')
    let group = groups.get(text)
    if (!group) {
      group = { text, split: row.split, features: new Map([['nicknames', 1]]) }
      groups.set(text, group)
    }
    const add = (key: string) => group.features.set(key, (group.features.get(key) ?? 0) + 1)
    add('images')
    for (const char of text) {
      add(`group:${characterGroup(char)}`)
      add(`char:${char}`)
    }
  }
  const totals = new Map<string, number>()
  for (const group of groups.values()) {
    for (const [key, value] of group.features) {
      totals.set(key, (totals.get(key) ?? 0) + value)
    }
  }
  const counts = mapToObj(assignedSplits, (split) => [split, new Map<string, number>()])
  const assignment = new Map<string, AssignedSplit>()
  const update = (group: NicknameGroup, split: AssignedSplit, direction: number) => {
    for (const [key, value] of group.features) {
      counts[split].set(key, (counts[split].get(key) ?? 0) + direction * value)
    }
  }
  const kinds = {
    group: characterGroups.length,
    char: Math.max(1, [...totals.keys()].filter((key) => key.startsWith('char:')).length)
  }
  const costChange = (group: NicknameGroup, split: AssignedSplit, direction: number) => {
    let result = 0
    for (const [key, value] of group.features) {
      const total = totals.get(key)!
      const target = (total * options.ratios[split]) / 100
      const before = (counts[split].get(key) ?? 0) - target
      let weight: number
      if (key === 'images') {
        weight = 4
      } else if (key === 'nicknames') {
        weight = 1
      } else if (key.startsWith('group:')) {
        weight = 2 / kinds.group
      } else {
        weight = 1 / kinds.char
      }
      // A character occurring once has no hard requirement to occur in each split.
      result +=
        (weight * ((before + direction * value) ** 2 - before ** 2)) /
        Math.max(key.startsWith('char:') ? 10 : 1, total) ** 2
    }

    return result
  }
  const movable = [...groups.values()].filter(
    (group) =>
      !protectedNicknames.has(group.text) &&
      !trainOnly.has(group.text) &&
      (options.replaceExisting || group.split === 'unassigned')
  )
  for (const group of groups.values()) {
    if (trainOnly.has(group.text)) {
      assignment.set(group.text, 'train')
      update(group, 'train', 1)
    } else if (!options.replaceExisting && group.split !== 'unassigned') {
      assignment.set(group.text, group.split)
      update(group, group.split, 1)
    }
  }
  const rarity = (group: NicknameGroup) =>
    [...group.features]
      .filter(([key]) => key.startsWith('char:'))
      .reduce((sum, [key, value]) => sum + value / totals.get(key)!, 0)
  movable.sort((a, b) => {
    const rarityDifference = rarity(b) - rarity(a)
    if (rarityDifference) {

      return rarityDifference
    }
    const imageDifference = b.features.get('images')! - a.features.get('images')!
    if (imageDifference) {

      return imageDifference
    }

    return compareText(a.text, b.text)
  })
  const destinations = assignedSplits.filter((split) => options.ratios[split] > 0)
  for (const group of movable) {
    const split = destinations.reduce((best, candidate) => {
      if (costChange(group, candidate, 1) < costChange(group, best, 1)) {

        return candidate
      }

      return best
    })
    assignment.set(group.text, split)
    update(group, split, 1)
  }
  for (let pass = 0; pass < 8; pass++) {
    let moved = false
    for (const group of movable) {
      const current = assignment.get(group.text)!
      const destination = destinations.find(
        (split) =>
          split !== current && costChange(group, current, -1) + costChange(group, split, 1) < -1e-12
      )
      if (destination) {
        update(group, current, -1)
        update(group, destination, 1)
        assignment.set(group.text, destination)
        moved = true
      }
    }
    if (!moved) {
      break
    }
  }
  const assignments = pipe(
    [...assignment],
    sort(([a], [b]) => compareText(a, b)),
    map(([text, split]) => ({ text, split }))
  )
  const proposed = map(rows, (row) => {
    const proposedRow = { ...row }
    if (row.text === null) {
      proposedRow.split = row.split
    } else {
      proposedRow.split = assignment.get(row.text.normalize('NFC')) ?? row.split
    }

    return proposedRow
  })
  const before = splitStatistics(rows)
  const after = splitStatistics(proposed)
  const preservedUnassignedNicknames = [...groups.values()].filter((group) =>
    protectedNicknames.has(group.text)
  ).length
  const changedNicknames = assignments.filter(
    ({ text, split }) => groups.get(text)!.split !== split
  ).length
  const reassignedNicknames = assignments.filter(
    ({ text, split }) =>
      groups.get(text)!.split !== 'unassigned' && groups.get(text)!.split !== split
  ).length

  return {
    options,
    before,
    after,
    assignments,
    preservedUnassignedNicknames,
    changedNicknames,
    reassignedNicknames
  }
}

export type SplitStatistics = ReturnType<typeof splitStatistics>
export type SplitPreview = ReturnType<typeof planSplits> & {
  fingerprint: string
  initialized: boolean
}
