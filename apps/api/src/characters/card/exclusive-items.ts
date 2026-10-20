import { isRecord } from '@dfragon/lib/utils/shape-check'
import table from './exclusive-items.json' with { type: 'json' }

// Neople item responses carry no 유일 장비 flag, so the repository lists the item names per slot.
export interface ExclusiveItemTable {
  version: 1
  source: { guide: string; checked_at: string }
  slots: Record<string, string[]>
}

const invalidTable = 'Invalid exclusive item table'

function isNameList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((name) => typeof name === 'string' && name !== '')
  )
}

// The table is a repository file, so a malformed table fails at startup instead of hiding the glow.
export function parseExclusiveItemTable(value: unknown): ExclusiveItemTable {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isRecord(value.source) ||
    typeof value.source.guide !== 'string' ||
    typeof value.source.checked_at !== 'string' ||
    !isRecord(value.slots)
  ) {
    throw new Error(invalidTable)
  }
  const slots: ExclusiveItemTable['slots'] = {}
  for (const [slotId, names] of Object.entries(value.slots)) {
    if (!isNameList(names)) {
      throw new Error(invalidTable)
    }
    slots[slotId] = names
  }
  const source = { guide: value.source.guide, checked_at: value.source.checked_at }

  return { version: 1, source, slots }
}

// A name counts only in the slot the table lists it under.
export function isExclusiveItem(
  items: ExclusiveItemTable,
  slotId: string,
  itemName: string | null
): boolean {
  const names = items.slots[slotId]

  return itemName !== null && names !== undefined && names.includes(itemName)
}

export const exclusiveItems = parseExclusiveItemTable(table)
