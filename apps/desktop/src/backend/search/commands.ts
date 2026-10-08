import { SEARCH_ACTIONS } from '../../preload/common/types/search'
import { z } from 'zod'
import { CHARACTER_SERVER_NAMES } from '../../preload/common/search/character-summary'
import type { CharacterSelectionReference } from '../../preload/common/types/character-detail'
import type {
  OcrSearchObservation,
  SearchControl,
  SearchObservation
} from '../../preload/common/types/search'

const MAX_NICKNAME_INPUT_LENGTH = 24
const text = z.string()
const SEARCH_ID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const uuid = text.regex(SEARCH_ID_PATTERN)
const safeInteger = z.int()
const observationRevision = safeInteger.positive()
const slot = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
const controlSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal(SEARCH_ACTIONS.READ) }),
  z.strictObject({ action: z.literal(SEARCH_ACTIONS.BEGIN) }),
  z.strictObject({
    action: z.literal(SEARCH_ACTIONS.LOOKUP),
    captureId: uuid,
    slot,
    observationRevision,
    nickname: text.max(MAX_NICKNAME_INPUT_LENGTH),
    serverId: z.enum(Object.keys(CHARACTER_SERVER_NAMES))
  }),
  z.strictObject({ action: z.literal(SEARCH_ACTIONS.END), captureId: uuid }),
  z.strictObject({
    action: z.literal(SEARCH_ACTIONS.CLEAR),
    captureId: uuid,
    slot,
    observationRevision
  }),
  z.strictObject({
    action: z.literal(SEARCH_ACTIONS.RETRY),
    captureId: uuid,
    slot,
    requestId: uuid
  })
])
const observationSchema = z.strictObject({
  captureId: uuid,
  slot,
  observationRevision,
  nickname: text
})
const selectionSchema = z.strictObject({ captureId: uuid, slot, requestId: uuid })

export function parseCharacterSelection(args: unknown[]): CharacterSelectionReference | null {
  return parseCommand({ args, schema: selectionSchema })
}

const MAX_OCR_NAMES = 2
const MAX_OCR_NAME_CODE_POINTS = 12
const MAX_PORTRAIT_DIMENSION = 512
const MAX_PORTRAIT_PIXELS = 262_144
const MAX_NORMALIZED_PORTRAIT_DIMENSION = 256
const RGBA_CHANNELS = 4
const ocrNickname = z.string().refine((value) => {
  const length = [...value].length

  return length <= MAX_OCR_NAME_CODE_POINTS && value === value.trim() && value.isWellFormed()
})
const portraitImage = z
  .strictObject({
    width: z.int().positive().max(MAX_PORTRAIT_DIMENSION),
    height: z.int().positive().max(MAX_PORTRAIT_DIMENSION),
    rgba: z.instanceof(Uint8Array)
  })
  .refine((image) => {
    const pixels = image.width * image.height

    return pixels <= MAX_PORTRAIT_PIXELS && image.rgba.length === pixels * RGBA_CHANNELS
  })
const portraitSchema = z
  .strictObject({
    image: portraitImage,
    rasterScale: z.number().positive(),
    validMask: z.instanceof(Uint8Array).optional()
  })
  .refine((portrait) => {
    const width = Math.round(portrait.image.width / portrait.rasterScale)
    const height = Math.round(portrait.image.height / portrait.rasterScale)
    const mask = portrait.validMask

    return (
      width >= 1 &&
      height >= 1 &&
      width <= MAX_NORMALIZED_PORTRAIT_DIMENSION &&
      height <= MAX_NORMALIZED_PORTRAIT_DIMENSION &&
      (mask === undefined ||
        (mask.length === portrait.image.width * portrait.image.height &&
          mask.every((value) => value === 0 || value === 1)))
    )
  })
const ocrObservationSchema = observationSchema
  .extend({
    nickname: ocrNickname,
    candidateNicknames: z.array(text.max(MAX_NICKNAME_INPUT_LENGTH)).min(1).max(MAX_OCR_NAMES),
    portrait: portraitSchema.nullable()
  })
  .refine((input) => input.nickname === input.candidateNicknames[0])

function parseCommand<T extends object>({
  args,
  schema
}: {
  args: unknown[]
  schema: z.ZodType<T>
}): T | null {
  const hasOneArgument = args.length === 1
  const value = args[0]
  const isObject = value != null && typeof value === 'object' && !Array.isArray(value)
  const canParse = hasOneArgument && isObject
  if (!canParse) {
    return null
  }

  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    return null
  }
  const keys = Reflect.ownKeys(value)
  const hasExactKeyCount = keys.length === Object.keys(parsed.data).length
  const hasOnlyExpectedKeys = keys.every((key) => {
    const isStringKey = typeof key === 'string'
    if (!isStringKey) {
      return false
    }
    const isExpectedKey = Object.hasOwn(parsed.data, key)

    return isExpectedKey
  })
  const hasExactKeys = hasExactKeyCount && hasOnlyExpectedKeys

  if (!hasExactKeys) {
    return null
  }

  return parsed.data
}

export function parseSearchControl(args: unknown[]): SearchControl | null {
  return parseCommand({ args, schema: controlSchema })
}

export function parseSearchObservation(args: unknown[]): SearchObservation | null {
  return parseCommand({ args, schema: observationSchema })
}

export function parseOcrSearchObservation(args: unknown[]): OcrSearchObservation | null {
  const parsed = parseCommand({ args, schema: ocrObservationSchema })
  if (parsed === null || !hasExactOcrShape(args[0], parsed)) {
    return null
  }

  return parsed
}

function hasExactOcrShape(input: unknown, parsed: unknown): boolean {
  if (parsed === null || typeof parsed !== 'object' || parsed instanceof Uint8Array) {
    return true
  }

  if (input === null || typeof input !== 'object') {
    return false
  }
  const keys = Reflect.ownKeys(parsed)

  return (
    Reflect.ownKeys(input).length === keys.length &&
    keys.every(
      (key) =>
        Object.hasOwn(input, key) &&
        hasExactOcrShape(Reflect.get(input, key), Reflect.get(parsed, key))
    )
  )
}
