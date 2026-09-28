import { OcrError, OCR_ERROR_CODE } from './errors.js'
import { parseInputRecord } from './input.js'
import type { Split } from './model.js'

export const assignedSplits = ['train', 'val', 'test'] as const
export const characterGroups = [
  'hangul',
  'special',
  'hiragana',
  'katakana',
  'hanja',
  'latin',
  'digit',
  'other'
] as const
export type CharacterGroup = (typeof characterGroups)[number]
type AssignedSplit = (typeof assignedSplits)[number]
export type SplitOptions = { ratios: Record<AssignedSplit, number>; replaceExisting: boolean }
export type SplitRow = { id: string; text: string | null; excluded: boolean; split: Split }

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

function distribution(rows: SplitRow[]) {
  const groups = Object.fromEntries(characterGroups.map((group) => [group, 0])) as Record<
    CharacterGroup,
    number
  >
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const char of row.text!) {
      groups[characterGroup(char)]++
      counts.set(char, (counts.get(char) ?? 0) + 1)
    }
  }
  return {
    images: rows.length,
    nicknames: new Set(rows.map((row) => row.text)).size,
    characters: [...counts.values()].reduce((sum, count) => sum + count, 0),
    groups,
    frequencies: [...counts]
      .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
      .map(([character, count]) => ({ character, count, group: characterGroup(character) }))
  }
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

export function splitStatistics(rows: SplitRow[]) {
  const eligible = rows.filter((row) => row.text !== null && !row.excluded)
  return {
    total: distribution(eligible),
    splits: Object.fromEntries(
      [...assignedSplits, 'unassigned' as const].map((split) => [
        split,
        distribution(eligible.filter((row) => row.split === split))
      ])
    ),
    skipped: rows.length - eligible.length
  }
}

/** Greedy stratification with bounded local improvement; rare characters are soft objectives. */
export function planSplits(rows: SplitRow[], options: SplitOptions) {
  const eligible = rows.filter((row) => row.text !== null && !row.excluded)
  if (eligible.length === 0) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  const groups = new Map<string, { text: string; split: Split; features: Map<string, number> }>()
  for (const row of eligible) {
    const text = row.text!.normalize('NFC')
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
  const counts = Object.fromEntries(
    assignedSplits.map((split) => [split, new Map<string, number>()])
  ) as Record<AssignedSplit, Map<string, number>>
  const assignment = new Map<string, AssignedSplit>()
  const update = (
    group: typeof groups extends Map<string, infer G> ? G : never,
    split: AssignedSplit,
    direction: number
  ) => {
    for (const [key, value] of group.features) {
      counts[split].set(key, (counts[split].get(key) ?? 0) + direction * value)
    }
  }
  const kinds = {
    group: characterGroups.length,
    char: Math.max(1, [...totals.keys()].filter((key) => key.startsWith('char:')).length)
  }
  const costChange = (
    group: typeof groups extends Map<string, infer G> ? G : never,
    split: AssignedSplit,
    direction: number
  ) => {
    let result = 0
    for (const [key, value] of group.features) {
      const total = totals.get(key)!
      const target = (total * options.ratios[split]) / 100
      const before = (counts[split].get(key) ?? 0) - target
      const weight =
        key === 'images'
          ? 4
          : key === 'nicknames'
            ? 1
            : key.startsWith('group:')
              ? 2 / kinds.group
              : 1 / kinds.char
      // A character occurring once has no hard requirement to occur in each split.
      result +=
        (weight * ((before + direction * value) ** 2 - before ** 2)) /
        Math.max(key.startsWith('char:') ? 10 : 1, total) ** 2
    }
    return result
  }
  const movable = [...groups.values()].filter(
    (group) => options.replaceExisting || group.split === 'unassigned'
  )
  for (const group of groups.values()) {
    if (!options.replaceExisting && group.split !== 'unassigned') {
      assignment.set(group.text, group.split)
      update(group, group.split, 1)
    }
  }
  const rarity = (group: (typeof movable)[number]) =>
    [...group.features]
      .filter(([key]) => key.startsWith('char:'))
      .reduce((sum, [key, value]) => sum + value / totals.get(key)!, 0)
  movable.sort(
    (a, b) =>
      rarity(b) - rarity(a) ||
      b.features.get('images')! - a.features.get('images')! ||
      compareText(a.text, b.text)
  )
  const destinations = assignedSplits.filter((split) => options.ratios[split] > 0)
  for (const group of movable) {
    const split = destinations.reduce((best, candidate) =>
      costChange(group, candidate, 1) < costChange(group, best, 1) ? candidate : best
    )
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
  const assignments = [...assignment]
    .sort(([a], [b]) => compareText(a, b))
    .map(([text, split]) => ({ text, split }))
  const proposed = rows.map((row) => ({
    ...row,
    split: row.text === null ? row.split : (assignment.get(row.text.normalize('NFC')) ?? row.split)
  }))
  return {
    options,
    before: splitStatistics(rows),
    after: splitStatistics(proposed),
    assignments,
    changedNicknames: assignments.filter(({ text, split }) => groups.get(text)!.split !== split)
      .length,
    reassignedNicknames: assignments.filter(
      ({ text, split }) =>
        groups.get(text)!.split !== 'unassigned' && groups.get(text)!.split !== split
    ).length
  }
}

export type SplitStatistics = ReturnType<typeof splitStatistics>
export type SplitPreview = ReturnType<typeof planSplits> & {
  fingerprint: string
  initialized: boolean
}
