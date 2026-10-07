import { inflateSync } from 'node:zlib'
import { PNG } from 'pngjs'
import type { CharacterImage } from '../../preload/common/types/character'
import { SearchHttpFailure } from './http'

const PNG_SIGNATURE_HEX = '89504e470d0a1a0a'
const PNG_HEADER_BYTES = 33
const PNG_IHDR_LENGTH = 13
const PNG_CHUNK_OVERHEAD_BYTES = 12
const PNG_MAX_BYTES_PER_PIXEL = 8
const PNG_INTERLACE_PASSES = 7
const RGBA_CHANNELS = 4

export const CHARACTER_IMAGE_LIMITS = {
  imageBytes: 4 * 1024 * 1024,
  imageDimension: 2048,
  imagePixels: 1024 * 1024
} as const

/** pngjs가 허용하는 중복 IHDR과 상한 없는 인터레이스 압축 해제를 먼저 차단한다. */
function boundPngInflation(bytes: Buffer, width: number, height: number): void {
  const compressed: Buffer[] = []
  let offset = 8
  let headerSeen = false
  let endSeen = false
  while (offset + PNG_CHUNK_OVERHEAD_BYTES <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const end = offset + PNG_CHUNK_OVERHEAD_BYTES + length
    if (end > bytes.length) {
      throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
    }
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    if (type === 'IHDR') {
      if (headerSeen) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      headerSeen = true
    } else if (type === 'IDAT') {
      compressed.push(bytes.subarray(offset + 8, end - 4))
    } else if (type === 'IEND') {
      endSeen = true
      if (end !== bytes.length) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
    }
    offset = end
  }
  if (offset !== bytes.length || !endSeen || compressed.length === 0) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  // 16비트 RGBA와 Adam7의 일곱 패스를 포함하는 압축 해제 상한이다.
  const maxOutputLength = width * height * PNG_MAX_BYTES_PER_PIXEL + height * PNG_INTERLACE_PASSES
  try {
    inflateSync(Buffer.concat(compressed), { maxOutputLength })
  } catch {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
}

/** pngjs가 RGBA 이미지를 할당하기 전에 크기와 압축 해제 상한을 검증한다. */
export function decodeCharacterImage(bytes: Buffer): CharacterImage {
  if (
    bytes.length < PNG_HEADER_BYTES ||
    bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE_HEX ||
    bytes.readUInt32BE(8) !== PNG_IHDR_LENGTH ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (
    width < 1 ||
    height < 1 ||
    width > CHARACTER_IMAGE_LIMITS.imageDimension ||
    height > CHARACTER_IMAGE_LIMITS.imageDimension ||
    width * height > CHARACTER_IMAGE_LIMITS.imagePixels
  ) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  boundPngInflation(bytes, width, height)
  try {
    const decoded = PNG.sync.read(bytes)
    if (
      decoded.width !== width ||
      decoded.height !== height ||
      decoded.data.length !== width * height * RGBA_CHANNELS
    ) {
      throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
    }
    const rgba = new Uint8Array(decoded.data)

    return { width, height, rgba }
  } catch {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
}
