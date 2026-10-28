import { z } from 'zod'
import { selectedCharacterSummarySchema } from './character-summary'
import {
  CHARACTER_SELECTION_METHODS,
  SEARCH_COMMAND_ERRORS,
  SEARCH_ERRORS,
  SEARCH_SLOT_COUNTS,
  SEARCH_SLOT_STATES,
  SELECTED_DETAILS_STATES,
  type SearchCommandResult,
  type SearchSlotCount,
  type SearchSnapshot
} from '../types/search'
import type { CharacterIdentity } from '../types/character'

const SEARCH_ID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const uuid = z.string().regex(SEARCH_ID_PATTERN)
const revision = z.int().nonnegative()
const nonblank = z.string().refine((value) => {
  const hasText = value.trim().length > 0

  return hasText
})
const row = z.strictObject({
  characterId: nonblank,
  characterName: nonblank,
  serverId: nonblank,
  serverName: z.string().nullable(),
  fame: z.number().nullable()
})
const faceWindow = z.strictObject({
  x: z.int().nonnegative(),
  y: z.int().nonnegative(),
  width: z.int().positive(),
  height: z.int().positive()
})
const choice = row.extend({
  adventureName: z.string().nullable(),
  face: faceWindow.nullable()
})
const errorFields = z.strictObject({
  code: z.enum(Object.keys(SEARCH_ERRORS) as Array<keyof typeof SEARCH_ERRORS>),
  retryAfterSeconds: revision.nullable()
})
const error = errorFields.refine(hasAllowedRetryDelay)
const slotFields = z.strictObject({
  slot: z
    .int()
    .min(0)
    .max(SEARCH_SLOT_COUNTS.raid - 1),
  observationRevision: revision,
  requestId: uuid.nullable(),
  nickname: z.string().nullable(),
  state: z.enum(SEARCH_SLOT_STATES),
  rows: z.array(row),
  error: error.nullable(),
  selected: selectedCharacterSummarySchema.optional(),
  selectionMethod: z.enum(CHARACTER_SELECTION_METHODS).optional(),
  choices: z.array(choice).min(2).optional(),
  details: z.enum(SELECTED_DETAILS_STATES).optional()
})
type SlotFields = z.infer<typeof slotFields>
const SELECTION_FIELDS = ['selected', 'selectionMethod', 'choices', 'details'] as const
const slot = slotFields.refine(hasValidSelection).refine(hasResultForState)

function hasAllowedRetryDelay(value: z.infer<typeof errorFields>): boolean {
  if (value.code === 'SEARCH_RATE_LIMITED') {
    return true
  }

  return value.retryAfterSeconds === null
}

function isSameCharacter(left: CharacterIdentity, right: CharacterIdentity): boolean {
  return left.serverId === right.serverId && left.characterId === right.characterId
}

function hasSelectionField(slot: SlotFields): boolean {
  return SELECTION_FIELDS.some((field) => Object.hasOwn(slot, field))
}

function hasSingleSuccessRow(slot: SlotFields): boolean {
  return slot.state === 'success' && slot.rows.length === 1
}

function hasValidSelection(slot: SlotFields): boolean {
  const { selected, choices } = slot
  if (selected === undefined) {
    return !hasSelectionField(slot)
  }

  if (!hasSingleSuccessRow(slot)) {
    return false
  }

  if (!isSameCharacter(slot.rows[0], selected)) {
    return false
  }

  if (!Object.hasOwn(slot, 'choices')) {
    return true
  }

  if (choices === undefined) {
    return false
  }

  return choices.some((choice) => isSameCharacter(choice, selected))
}

function hasNoRequest(slot: SlotFields): boolean {
  return slot.requestId === null && slot.nickname === null
}

function isObservedRequest(slot: SlotFields): boolean {
  return slot.requestId !== null && slot.nickname !== null && slot.observationRevision > 0
}

function hasNoResult(slot: SlotFields): boolean {
  return slot.rows.length === 0 && slot.error === null
}

function hasResultForState(slot: SlotFields): boolean {
  if (slot.state === 'idle') {
    return hasNoRequest(slot) && hasNoResult(slot)
  }

  if (!isObservedRequest(slot)) {
    return false
  }

  if (slot.state === 'success') {
    return slot.rows.length > 0 && slot.error === null
  }

  if (slot.state === 'failure') {
    return slot.rows.length === 0 && slot.error !== null
  }

  return hasNoResult(slot)
}

function hasOrderedSlots(slots: readonly SlotFields[]): boolean {
  return slots.every((slot, index) => slot.slot === index)
}

function isResetSlot(slot: SlotFields): boolean {
  return slot.state === 'idle' && slot.observationRevision === 0
}

function fitsCaptureLifetime(captureId: string | null, slots: readonly SlotFields[]): boolean {
  if (captureId !== null) {
    return true
  }

  return slots.every(isResetSlot)
}

function createSchemas(slotCount: SearchSlotCount) {
  const snapshot = z
    .strictObject({
      runId: uuid,
      revision,
      captureId: uuid.nullable(),
      slots: z.array(slot).length(slotCount)
    })
    .refine(({ slots }) => hasOrderedSlots(slots))
    .refine(({ captureId, slots }) => fitsCaptureLifetime(captureId, slots))
  const result = z.discriminatedUnion('ok', [
    z.strictObject({ ok: z.literal(true), snapshot }),
    z.strictObject({
      ok: z.literal(false),
      snapshot,
      error: z.strictObject({
        code: z.enum(SEARCH_COMMAND_ERRORS)
      })
    })
  ])

  return { snapshot, result }
}
const schemas = {
  [SEARCH_SLOT_COUNTS.party]: createSchemas(SEARCH_SLOT_COUNTS.party),
  [SEARCH_SLOT_COUNTS.raid]: createSchemas(SEARCH_SLOT_COUNTS.raid)
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object'
}

function hasExactOwnShape(input: unknown, parsed: unknown): boolean {
  if (!isObject(parsed)) {
    return true
  }

  if (!isObject(input)) {
    return false
  }
  const expectedKeys = Reflect.ownKeys(parsed)
  if (Reflect.ownKeys(input).length !== expectedKeys.length) {
    return false
  }

  return expectedKeys.every((key) => hasExactOwnField(input, parsed, key))
}

function hasExactOwnField(input: object, parsed: object, key: PropertyKey): boolean {
  if (!Object.hasOwn(input, key)) {
    return false
  }

  return hasExactOwnShape(Reflect.get(input, key), Reflect.get(parsed, key))
}

export function parseSearchSnapshot(
  value: unknown,
  slotCount: SearchSlotCount = SEARCH_SLOT_COUNTS.party
): SearchSnapshot | null {
  const parsed = schemas[slotCount].snapshot.safeParse(value)
  const isValid = parsed.success && hasExactOwnShape(value, parsed.data)
  if (isValid) {
    return parsed.data
  }

  return null
}

export function parseSearchResult(
  value: unknown,
  slotCount: SearchSlotCount = SEARCH_SLOT_COUNTS.party
): SearchCommandResult | null {
  const parsed = schemas[slotCount].result.safeParse(value)
  const isValid = parsed.success && hasExactOwnShape(value, parsed.data)
  if (isValid) {
    return parsed.data
  }

  return null
}
