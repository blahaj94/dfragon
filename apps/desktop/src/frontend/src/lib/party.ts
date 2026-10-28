import {
  detectPartyFrameGeometry,
  isValidPartyFrameSize,
  PartyFrameGeometryError,
  type PartyFrameGeometry
} from '@dfragon/lib'
import { binarizeNicknamePixels } from './nickname-pixels'
import { SEARCH_SLOT_COUNTS } from '../../../preload/common/types/search'
import type { CharacterImage, CharacterPortrait } from '../../../preload/common/types/character'
import { cropPartyPortrait } from './party-portrait'

const RGBA_CHANNELS = 4
const ALPHA_CHANNEL = 3

function detectGeometry(
  frame: Parameters<typeof detectPartyFrameGeometry>[0]
): PartyFrameGeometry | null {
  try {
    return detectPartyFrameGeometry(frame)
  } catch (error) {
    if (error instanceof PartyFrameGeometryError && error.reason !== 'invalid-frame') {
      return null
    }
    throw error
  }
}

function containsExcludedPixels(pixels: ArrayLike<number>): boolean {
  for (let index = ALPHA_CHANNEL; index < pixels.length; index += RGBA_CHANNELS) {
    if (pixels[index] === 0) {
      return true
    }
  }

  return false
}

type PartyRecognitionInput = {
  slot: number
  nickname: HTMLCanvasElement
  portrait: CharacterPortrait | null
}

export function capturePartyRecognitionInputs(
  source: CharacterImage
): (PartyRecognitionInput | null)[] {
  const crops: (PartyRecognitionInput | null)[] = Array.from(
    { length: SEARCH_SLOT_COUNTS.party },
    () => null
  )
  const { width, height } = source
  if (!isValidPartyFrameSize(width, height)) {
    return crops
  }

  const frame = document.createElement('canvas')
  frame.width = width
  frame.height = height
  const frameContext = frame.getContext('2d')
  if (frameContext == null) {
    throw new Error('Could not create a party capture canvas.')
  }

  if (source.rgba.byteLength !== width * height * RGBA_CHANNELS) {
    throw new Error('Invalid native capture pixels.')
  }
  const image = frameContext.createImageData(width, height)
  image.data.set(source.rgba)
  frameContext.putImageData(image, 0, 0)
  const pixels = frameContext.getImageData(0, 0, width, height).data
  const rgba = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)
  const geometry = detectGeometry({ width, height, rgba })
  if (geometry === null) {
    return crops
  }

  for (const region of geometry.slots) {
    const nicknamePixels = frameContext.getImageData(
      region.x,
      region.y,
      region.width,
      region.height
    )
    if (containsExcludedPixels(nicknamePixels.data)) {
      continue
    }
    binarizeNicknamePixels(nicknamePixels.data)
    const nickname = document.createElement('canvas')
    nickname.width = region.width
    nickname.height = region.height
    const nicknameContext = nickname.getContext('2d')
    if (nicknameContext == null) {
      throw new Error('Could not create a party nickname canvas.')
    }
    nicknameContext.putImageData(nicknamePixels, 0, 0)
    const slot = region.slot - 1
    const portrait = cropPartyPortrait({
      frame: { width, height, rgba },
      nicknameRegion: region,
      rasterScale: geometry.scale
    })
    if (portrait !== null && containsExcludedPixels(portrait.image.rgba)) {
      continue
    }
    crops[slot] = { slot, nickname, portrait }
  }

  return crops
}
