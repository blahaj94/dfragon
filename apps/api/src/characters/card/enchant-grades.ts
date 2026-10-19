import table from './enchant-grades.json' with { type: 'json' }
import type { EnchantGrade, EnchantStatus } from './types.js'
import { isRecord } from './values.js'

export interface EnchantGradeEntry {
  status: EnchantStatus[]
  // Different cards that give the same options share one entry that lists every card name.
  cardNames?: string[]
}

export interface EnchantGradeTable {
  version: 1
  source: { dataset: string; generated_at: string | null }
  slots: Record<string, Partial<Record<EnchantGrade, EnchantGradeEntry[]>>>
}

// A slot listed under more than one grade resolves to the strongest grade first.
const enchantGradeOrder: readonly EnchantGrade[] = ['종결', '준종결', '기타']

const invalidTable = 'Invalid enchant grade table'

function isEnchantGrade(value: string): value is EnchantGrade {
  return (enchantGradeOrder as readonly string[]).includes(value)
}

export function isEnchantStatusValue(value: unknown): value is EnchantStatus['value'] {
  const isFiniteNumber = typeof value === 'number' && Number.isFinite(value)
  const isText = typeof value === 'string' && value !== ''

  return isFiniteNumber || isText
}

function parseEntry(value: unknown): EnchantGradeEntry {
  if (!isRecord(value) || !Array.isArray(value.status) || value.status.length === 0) {
    throw new Error(invalidTable)
  }
  const status = value.status.map((option): EnchantStatus => {
    if (
      !isRecord(option) ||
      typeof option.name !== 'string' ||
      option.name === '' ||
      !isEnchantStatusValue(option.value)
    ) {
      throw new Error(invalidTable)
    }

    return { name: option.name, value: option.value }
  })
  if (value.cardNames === undefined) {
    return { status }
  }
  const cardNames = value.cardNames
  const isNameList =
    Array.isArray(cardNames) &&
    cardNames.length > 0 &&
    cardNames.every((name) => typeof name === 'string' && name !== '')
  if (!isNameList) {
    throw new Error(invalidTable)
  }

  return { status, cardNames }
}

// The table is a repository file, so a malformed table fails at startup instead of grading silently.
export function parseEnchantGradeTable(value: unknown): EnchantGradeTable {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isRecord(value.source) ||
    typeof value.source.dataset !== 'string' ||
    (value.source.generated_at !== null && typeof value.source.generated_at !== 'string') ||
    !isRecord(value.slots)
  ) {
    throw new Error(invalidTable)
  }
  const slots: EnchantGradeTable['slots'] = {}
  for (const [slotId, grades] of Object.entries(value.slots)) {
    if (!isRecord(grades)) {
      throw new Error(invalidTable)
    }
    const parsed: Partial<Record<EnchantGrade, EnchantGradeEntry[]>> = {}
    for (const [grade, entries] of Object.entries(grades)) {
      if (!isEnchantGrade(grade) || !Array.isArray(entries)) {
        throw new Error(invalidTable)
      }
      parsed[grade] = entries.map(parseEntry)
    }
    slots[slotId] = parsed
  }
  const source = { dataset: value.source.dataset, generated_at: value.source.generated_at }

  return { version: 1, source, slots }
}

function statusKey(status: readonly EnchantStatus[]): string {
  const options = status.map((option) => JSON.stringify([option.name, option.value])).sort()

  return JSON.stringify(options)
}

// Every option name and value must match; option order in the provider response is not significant.
export function gradeEnchant(
  grades: EnchantGradeTable,
  slotId: string,
  status: readonly EnchantStatus[]
): EnchantGrade | null {
  const slot = grades.slots[slotId]
  if (!slot || status.length === 0) {
    return null
  }
  const equipped = statusKey(status)
  const grade = enchantGradeOrder.find((name) =>
    slot[name]?.some((entry) => statusKey(entry.status) === equipped)
  )
  if (grade === undefined) {
    return null
  }

  return grade
}

export const enchantGrades = parseEnchantGradeTable(table)
