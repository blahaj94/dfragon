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

function parseFramelessResult(value: object): Exclude<WindowFrameResult, { kind: 'frame' }> | null {
  if (!('kind' in value)) {
    return null
  }

  if (value.kind === 'unsupported' && Reflect.ownKeys(value).length === 1) {
    return { kind: 'unsupported' }
  }

  if (
    value.kind === 'waiting' &&
    Reflect.ownKeys(value).length === 2 &&
    'reason' in value &&
    (value.reason === 'covered' || value.reason === 'unavailable')
  ) {
    return { kind: 'waiting', reason: value.reason }
  }

  return null
}

export function parseWindowFrame(value: unknown): WindowFrameResult {
  if (value === null || typeof value !== 'object' || !('kind' in value)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const frameless = parseFramelessResult(value)
  if (frameless !== null) {
    return frameless
  }

  if (value.kind === 'frame' && Reflect.ownKeys(value).length === 2 && 'image' in value) {
    const image = value.image
    if (
      image !== null &&
      typeof image === 'object' &&
      Reflect.ownKeys(image).length === 3 &&
      'width' in image &&
      'height' in image &&
      'rgba' in image &&
      typeof image.width === 'number' &&
      typeof image.height === 'number' &&
      isValidPartyFrameSize(image.width, image.height) &&
      image.rgba instanceof Uint8Array &&
      image.rgba.byteLength === image.width * image.height * RGBA_CHANNELS
    ) {
      const { width, height, rgba } = image

      return { kind: 'frame', image: { width, height, rgba } }
    }
  }

  throw new Error('CAPTURE_RESPONSE_INVALID')
}

function parseRaidCrop(value: unknown): CharacterImage {
  if (
    value === null ||
    typeof value !== 'object' ||
    Reflect.ownKeys(value).length !== 3 ||
    !('width' in value) ||
    !('height' in value) ||
    !('rgba' in value) ||
    !Number.isSafeInteger(value.width) ||
    !Number.isSafeInteger(value.height) ||
    typeof value.width !== 'number' ||
    typeof value.height !== 'number' ||
    value.width < 1 ||
    value.height < 1 ||
    value.width > MAX_RAID_CROP_WIDTH ||
    value.height > MAX_RAID_CROP_HEIGHT ||
    !(value.rgba instanceof Uint8Array) ||
    value.rgba.byteLength !== value.width * value.height * RGBA_CHANNELS
  ) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const { width, height, rgba } = value

  return { width, height, rgba }
}

function parseRaidRow(value: unknown): RaidFrameRow {
  if (
    value === null ||
    typeof value !== 'object' ||
    Reflect.ownKeys(value).length !== 3 ||
    !('nickname' in value) ||
    !('job' in value) ||
    !('valueText' in value) ||
    (value.valueText !== null &&
      (typeof value.valueText !== 'string' || !RAID_VALUE_TEXT_PATTERN.test(value.valueText)))
  ) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const nickname = parseRaidCrop(value.nickname)
  const job = value.job === null ? null : parseRaidCrop(value.job)

  return { nickname, job, valueText: value.valueText }
}

function isRaidValueColumn(value: unknown): value is RaidValueColumn {
  return RAID_VALUE_COLUMNS.some((column) => column === value)
}

export function parseRaidFrame(value: unknown): RaidFrameResult {
  if (value === null || typeof value !== 'object' || !('kind' in value)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const frameless = parseFramelessResult(value)
  if (frameless !== null) {
    return frameless
  }

  if (
    value.kind === 'missing' &&
    Reflect.ownKeys(value).length === 2 &&
    'reason' in value &&
    (value.reason === 'not-found' || value.reason === 'uncertain')
  ) {
    return { kind: 'missing', reason: value.reason }
  }

  if (
    value.kind === 'rows' &&
    Reflect.ownKeys(value).length === 3 &&
    'valueColumn' in value &&
    isRaidValueColumn(value.valueColumn) &&
    'rows' in value &&
    Array.isArray(value.rows) &&
    value.rows.length === SEARCH_SLOT_COUNTS.raid
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
