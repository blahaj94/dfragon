import {
  detectPartyFrameGeometry,
  isValidPartyFrameSize,
  PartyFrameGeometryError,
  type PartyFrameGeometry
} from '@dfragon/lib'
import { binarizeNicknamePixels } from './nickname-pixels'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import type { CharacterPortrait } from '../../../preload/common/types/character'
import { cropPartyPortrait, type PartyPortraitCropper } from './party-portrait'

export type PartyRecognitionInput = {
  slot: number
  nickname: HTMLCanvasElement
  portrait: CharacterPortrait | null
}

/** 현재 영상의 HP, MP 프레임에서 닉네임을 찾아 원본 크기의 반전 이진화 OCR 입력을 만든다. */
export function capturePartyNicknameCrops(video: HTMLVideoElement): (HTMLCanvasElement | null)[] {
  return capturePartyRecognitionInputs(video).map((input) => {
    if (input === null) {
      return null
    }

    return input.nickname
  })
}

/** 같은 영상 프레임의 닉네임과 교체 가능한 얼굴 크롭 결과를 슬롯 번호와 함께 묶는다. */
export function capturePartyRecognitionInputs(
  video: HTMLVideoElement,
  portraitCropper: PartyPortraitCropper = cropPartyPortrait
): (PartyRecognitionInput | null)[] {
  const crops: (PartyRecognitionInput | null)[] = Array.from(
    { length: PARTY_SLOT_COUNT },
    () => null
  )
  const width = video.videoWidth
  const height = video.videoHeight
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
  frameContext.drawImage(video, 0, 0)
  const pixels = frameContext.getImageData(0, 0, width, height).data
  const rgba = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)
  let geometry: PartyFrameGeometry
  try {
    geometry = detectPartyFrameGeometry({ width, height, rgba })
  } catch (error) {
    if (error instanceof PartyFrameGeometryError && error.reason !== 'invalid-frame') {
      // 프레임이 사라지거나 모호하면 이전 이름을 비우고 다음 영상에서 다시 검출한다.
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
    crops[slot] = { slot, nickname, portrait }
  }

  return crops
}
