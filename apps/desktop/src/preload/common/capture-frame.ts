import { isValidPartyFrameSize } from '@dfragon/lib'
import type { RaidFrameResult, RaidFrameRow, WindowFrameResult } from './types/capture'
import type { CharacterImage } from './types/character'
import {
  RAID_VALUE_COLUMNS,
  RAID_VALUE_TEXT_PATTERN,
  SEARCH_SLOT_COUNTS,
  type RaidValueColumn
} from './types/search'

const RGBA_CHANNELS = 4
// 공대 닉네임, 직업명 크롭은 UI 0%에서 86×17, 67×17이다. 큰 화면 배율을 받되 프레임 원본 크기의 값은 거절한다.
const MAX_RAID_CROP_WIDTH = 1024
const MAX_RAID_CROP_HEIGHT = 256

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object'
}

function hasExactFields<Field extends string>(
  value: unknown,
  fields: readonly Field[]
): value is Record<Field, unknown> {
  return (
    isObject(value) &&
    Reflect.ownKeys(value).length === fields.length &&
    fields.every((field) => field in value)
  )
}

function isWaitingReason(reason: unknown): reason is 'covered' | 'unavailable' {
  return reason === 'covered' || reason === 'unavailable'
}

function isMissingReason(reason: unknown): reason is 'not-found' | 'uncertain' {
  return reason === 'not-found' || reason === 'uncertain'
}

function parseFramelessResult(
  value: unknown
): Exclude<WindowFrameResult, { kind: 'frame' }> | null {
  if (hasExactFields(value, ['kind']) && value.kind === 'unsupported') {
    return { kind: 'unsupported' }
  }

  if (
    hasExactFields(value, ['kind', 'reason']) &&
    value.kind === 'waiting' &&
    isWaitingReason(value.reason)
  ) {
    return { kind: 'waiting', reason: value.reason }
  }

  return null
}

function hasRgbaPixels(rgba: unknown, width: number, height: number): rgba is Uint8Array {
  return rgba instanceof Uint8Array && rgba.byteLength === width * height * RGBA_CHANNELS
}

function parsePartyFrameImage(value: unknown): CharacterImage {
  if (!hasExactFields(value, ['width', 'height', 'rgba'])) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const { width, height, rgba } = value
  if (typeof width !== 'number' || typeof height !== 'number') {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }

  if (!isValidPartyFrameSize(width, height)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }

  if (!hasRgbaPixels(rgba, width, height)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }

  return { width, height, rgba }
}

export function parseWindowFrame(value: unknown): WindowFrameResult {
  const frameless = parseFramelessResult(value)
  if (frameless !== null) {
    return frameless
  }

  if (hasExactFields(value, ['kind', 'image']) && value.kind === 'frame') {
    const image = parsePartyFrameImage(value.image)

    return { kind: 'frame', image }
  }

  throw new Error('CAPTURE_RESPONSE_INVALID')
}

function isRaidCropLength(length: unknown, max: number): length is number {
  return typeof length === 'number' && Number.isSafeInteger(length) && length >= 1 && length <= max
}

function parseRaidCrop(value: unknown): CharacterImage {
  if (!hasExactFields(value, ['width', 'height', 'rgba'])) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const { width, height, rgba } = value
  if (!isRaidCropLength(width, MAX_RAID_CROP_WIDTH)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }

  if (!isRaidCropLength(height, MAX_RAID_CROP_HEIGHT)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }

  if (!hasRgbaPixels(rgba, width, height)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }

  return { width, height, rgba }
}

function isRaidValueText(value: unknown): value is string | null {
  if (value === null) {
    return true
  }

  return typeof value === 'string' && RAID_VALUE_TEXT_PATTERN.test(value)
}

function parseRaidRow(value: unknown): RaidFrameRow {
  if (!hasExactFields(value, ['nickname', 'job', 'valueText'])) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const { nickname, job, valueText } = value
  if (!isRaidValueText(valueText)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }

  const nicknameCrop = parseRaidCrop(nickname)
  const jobCrop = job !== null ? parseRaidCrop(job) : null

  return { nickname: nicknameCrop, job: jobCrop, valueText }
}

function isRaidRowList(rows: unknown): rows is unknown[] {
  return Array.isArray(rows) && rows.length === SEARCH_SLOT_COUNTS.raid
}

function isRaidValueColumn(value: unknown): value is RaidValueColumn {
  return RAID_VALUE_COLUMNS.some((column) => column === value)
}

export function parseRaidFrame(value: unknown): RaidFrameResult {
  const frameless = parseFramelessResult(value)
  if (frameless !== null) {
    return frameless
  }

  if (
    hasExactFields(value, ['kind', 'reason']) &&
    value.kind === 'missing' &&
    isMissingReason(value.reason)
  ) {
    return { kind: 'missing', reason: value.reason }
  }

  if (
    hasExactFields(value, ['kind', 'valueColumn', 'rows']) &&
    value.kind === 'rows' &&
    isRaidValueColumn(value.valueColumn) &&
    isRaidRowList(value.rows)
  ) {
    const rows = Array.from(value.rows, (row: unknown) => {
      if (row === null) {
        return null
      }

      return parseRaidRow(row)
    })

    return { kind: 'rows', valueColumn: value.valueColumn, rows }
  }

  throw new Error('CAPTURE_RESPONSE_INVALID')
}
