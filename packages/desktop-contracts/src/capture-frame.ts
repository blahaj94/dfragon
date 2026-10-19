import { isValidPartyFrameSize } from '@dfragon/lib'
import type { RaidFrameResult, WindowFrameResult } from './types/capture'
import type { CharacterImage } from './types/character'
import { SEARCH_SLOT_COUNTS } from './types/search'

const RGBA_CHANNELS = 4
// 공대 닉네임 크롭은 UI 0%에서 86×17이다. 큰 화면 배율을 받되 프레임 원본 크기의 값은 거절한다.
const MAX_RAID_NICKNAME_WIDTH = 1024
const MAX_RAID_NICKNAME_HEIGHT = 256
const FRAME_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 프레임 없이 끝난 캡처 응답(미지원, 가림과 읽기 대기)만 그대로 돌려주고 나머지는 null이다. */
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

/** 네이티브 캡처 응답의 크기와 픽셀 수를 IPC 경계에서 확인한다. */
export function parseWindowFrame(value: unknown): WindowFrameResult {
  if (value === null || typeof value !== 'object' || !('kind' in value)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const frameless = parseFramelessResult(value)
  if (frameless !== null) {
    return frameless
  }

  const hasFrameId = 'frameId' in value
  const validFrameId =
    hasFrameId && typeof value.frameId === 'string' && FRAME_ID_PATTERN.test(value.frameId)
  const frameKeyCount = hasFrameId ? 3 : 2
  if (
    value.kind === 'frame' &&
    Reflect.ownKeys(value).length === frameKeyCount &&
    (!hasFrameId || validFrameId) &&
    'image' in value
  ) {
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
      const frame = { width, height, rgba }
      if (validFrameId && typeof value.frameId === 'string') {
        return { kind: 'frame', image: frame, frameId: value.frameId }
      }

      return { kind: 'frame', image: frame }
    }
  }

  throw new Error('CAPTURE_RESPONSE_INVALID')
}

/** 공대 닉네임 크롭 하나의 크기와 바이트 수를 확인하고 추가 필드가 없는 복사본을 만든다. */
function parseRaidNickname(value: unknown): CharacterImage {
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
    value.width > MAX_RAID_NICKNAME_WIDTH ||
    value.height > MAX_RAID_NICKNAME_HEIGHT ||
    !(value.rgba instanceof Uint8Array) ||
    value.rgba.byteLength !== value.width * value.height * RGBA_CHANNELS
  ) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
  }
  const { width, height, rgba } = value

  return { width, height, rgba }
}

/** 공대 캡처 응답이 12행의 닉네임 크롭이나 정해진 미검출, 대기 사유만 담는지 IPC 경계에서 확인한다. */
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
    Reflect.ownKeys(value).length === 2 &&
    'nicknames' in value &&
    Array.isArray(value.nicknames) &&
    value.nicknames.length === SEARCH_SLOT_COUNTS.raid
  ) {
    const nicknames = Array.from(value.nicknames, (nickname: unknown) => {
      if (nickname === null) {
        return null
      }

      return parseRaidNickname(nickname)
    })

    return { kind: 'rows', nicknames }
  }

  throw new Error('CAPTURE_RESPONSE_INVALID')
}
