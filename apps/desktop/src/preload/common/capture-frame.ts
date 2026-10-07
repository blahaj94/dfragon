import { isValidPartyFrameSize } from '@dfragon/lib'
import type { WindowFrameResult } from './types/capture'

const RGBA_CHANNELS = 4

/** 네이티브 캡처 응답의 크기와 픽셀 수를 IPC 경계에서 확인한다. */
export function parseWindowFrame(value: unknown): WindowFrameResult {
  if (value === null || typeof value !== 'object' || !('kind' in value)) {
    throw new Error('CAPTURE_RESPONSE_INVALID')
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
      const frame = { width, height, rgba }

      return { kind: 'frame', image: frame }
    }
  }

  throw new Error('CAPTURE_RESPONSE_INVALID')
}
