import { isValidPartyFrameSize, type PartyFrameGeometry } from '@dfragon/lib'
import type { CharacterImage, CharacterPortrait } from '../../../preload/common/types/character'

export type PartyPortraitCropInput = Readonly<{
  frame: CharacterImage
  nicknameRegion: PartyFrameGeometry['slots'][number]
  rasterScale: number
}>
export type PartyPortraitCropper = (input: PartyPortraitCropInput) => CharacterPortrait | null

const RGBA_CHANNELS = 4
const MAX_PORTRAIT_DIMENSION = 512
// 600px 높이의 기본 HUD 픽셀 기준. x는 각 슬롯에서 검출한 HP, MP 시작점에 상대적이다.
const PORTRAIT_REGION = { leftOfTrack: 28, top: 11, size: 26 } as const
const PORTRAIT_MASK = { border: 1, topBorder: 2, badgeWidth: 12, badgeHeight: 9 } as const

/** 관측한 HUD 배율로 얼굴 원본을 복사하고 테두리, 왕관과 PC 표시 영역을 비교에서 제외한다. */
export const cropPartyPortrait: PartyPortraitCropper = ({ frame, nicknameRegion, rasterScale }) => {
  if (
    !isValidPartyFrameSize(frame.width, frame.height) ||
    !(frame.rgba instanceof Uint8Array) ||
    frame.rgba.length !== frame.width * frame.height * RGBA_CHANNELS ||
    !Number.isFinite(rasterScale) ||
    rasterScale <= 0 ||
    !Number.isSafeInteger(nicknameRegion.x)
  ) {
    throw new TypeError('Invalid party portrait crop input')
  }
  const left = Math.round(nicknameRegion.x - PORTRAIT_REGION.leftOfTrack * rasterScale)
  const top = Math.round(PORTRAIT_REGION.top * rasterScale)
  const size = Math.round(PORTRAIT_REGION.size * rasterScale)
  if (
    size < 1 ||
    size > MAX_PORTRAIT_DIMENSION ||
    left < 0 ||
    top < 0 ||
    left + size > frame.width ||
    top + size > frame.height
  ) {
    return null
  }
  const rgba = new Uint8Array(size * size * RGBA_CHANNELS)
  const validMask = new Uint8Array(size * size)
  const border = Math.ceil(PORTRAIT_MASK.border * rasterScale)
  const topBorder = Math.ceil(PORTRAIT_MASK.topBorder * rasterScale)
  const badgeWidth = Math.ceil(PORTRAIT_MASK.badgeWidth * rasterScale)
  const badgeHeight = Math.ceil(PORTRAIT_MASK.badgeHeight * rasterScale)
  let validPixels = 0
  for (let y = 0; y < size; y += 1) {
    const sourceStart = ((top + y) * frame.width + left) * RGBA_CHANNELS
    rgba.set(
      frame.rgba.subarray(sourceStart, sourceStart + size * RGBA_CHANNELS),
      y * size * RGBA_CHANNELS
    )
    for (let x = 0; x < size; x += 1) {
      const insideBorder = x >= border && x < size - border && y >= topBorder && y < size - border
      const coveredByBadge = y < badgeHeight && (x < badgeWidth || x >= size - badgeWidth)
      if (insideBorder && !coveredByBadge) {
        validMask[y * size + x] = 1
        validPixels += 1
      }
    }
  }

  if (validPixels === 0) {
    return null
  }
  const image = { width: size, height: size, rgba }

  return { image, rasterScale, validMask }
}
