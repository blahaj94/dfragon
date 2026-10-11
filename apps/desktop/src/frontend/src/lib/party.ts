import {
  detectPartyFrameGeometry,
  isValidPartyFrameSize,
  PartyFrameGeometryError,
  type PartyFrameGeometry
} from '@dfragon/lib'
import { binarizeNicknamePixels } from './nickname-pixels'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import type { CharacterImage, CharacterPortrait } from '../../../preload/common/types/character'
import { cropPartyPortrait, type PartyPortraitCropper } from './party-portrait'

const RGBA_CHANNELS = 4
const ALPHA_CHANNEL = 3

/** GDI 원본에서 다른 창의 가림 때문에 제외된 픽셀이 있는지 확인한다. */
function containsExcludedPixels(pixels: ArrayLike<number>): boolean {
  for (let index = ALPHA_CHANNEL; index < pixels.length; index += RGBA_CHANNELS) {
    if (pixels[index] === 0) {
      return true
    }
  }

  return false
}

export type PartyRecognitionInput = {
  slot: number
  nickname: HTMLCanvasElement
  portrait: CharacterPortrait | null
}

export type PartyFrameSource = (CharacterImage & { captureId?: string; frameId?: string }) | null

/** 같은 프레임의 닉네임과 교체 가능한 얼굴 크롭 결과를 슬롯 번호와 함께 묶는다. */
export function capturePartyRecognitionInputs(
  source: PartyFrameSource,
  portraitCropper: PartyPortraitCropper = cropPartyPortrait
): (PartyRecognitionInput | null)[] {
  const crops: (PartyRecognitionInput | null)[] = Array.from(
    { length: PARTY_SLOT_COUNT },
    () => null
  )
  if (source === null) {
    return crops
  }
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
  let geometry: PartyFrameGeometry
  try {
    geometry = detectPartyFrameGeometry({ width, height, rgba })
  } catch (error) {
    if (error instanceof PartyFrameGeometryError && error.reason !== 'invalid-frame') {
      // 프레임이 없거나 모호하면 빈 회차 결과로 돌려준다.
      return crops
    }
    throw error
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
    const portrait = portraitCropper({
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
