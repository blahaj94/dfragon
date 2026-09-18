import {
  PARTY_MANA_COLOR,
  PARTY_SLOTS,
  MANA_COLOR_TOLERANCE,
  MINIMUM_MANA_PIXELS
} from '../../constants/capture'

export function isPartySlotPresent(rgba: Uint8ClampedArray): boolean {
  let matches = 0

  for (let index = 0; index < rgba.length; index += 4) {
    const hasMatchingRed = Math.abs(rgba[index] - PARTY_MANA_COLOR[0]) <= MANA_COLOR_TOLERANCE
    if (!hasMatchingRed) {
      continue
    }
    const hasMatchingGreen = Math.abs(rgba[index + 1] - PARTY_MANA_COLOR[1]) <= MANA_COLOR_TOLERANCE
    if (!hasMatchingGreen) {
      continue
    }
    const hasMatchingBlue = Math.abs(rgba[index + 2] - PARTY_MANA_COLOR[2]) <= MANA_COLOR_TOLERANCE
    const hasManaColor = hasMatchingRed && hasMatchingGreen && hasMatchingBlue
    if (hasManaColor) {
      matches += 1
      const hasMinimumManaPixels = matches >= MINIMUM_MANA_PIXELS
      if (hasMinimumManaPixels) {
        return true
      }
    }
  }

  return false
}

export function capturePartyNicknameCrops(video: HTMLVideoElement): (HTMLCanvasElement | null)[] {
  const frame = document.createElement('canvas')
  frame.width = video.videoWidth
  frame.height = video.videoHeight
  const frameContext = frame.getContext('2d')
  const hasFrameContext = frameContext != null
  if (!hasFrameContext) {
    throw new Error('Could not create a party capture canvas.')
  }

  frameContext.drawImage(video, 0, 0)

  return PARTY_SLOTS.map((slot) => {
    const mana = frameContext.getImageData(
      slot.mana.x,
      slot.mana.y,
      slot.mana.width,
      slot.mana.height
    )
    const isSlotPresent = isPartySlotPresent(mana.data)
    if (!isSlotPresent) {
      return null
    }

    const pixels = frameContext.getImageData(
      slot.nickname.x,
      slot.nickname.y,
      slot.nickname.width,
      slot.nickname.height
    )
    // Turn the game's light text into dark text without thresholding away thin strokes.
    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance =
        0.2126 * pixels.data[index] +
        0.7152 * pixels.data[index + 1] +
        0.0722 * pixels.data[index + 2]
      const value = 255 - luminance
      pixels.data[index] = value
      pixels.data[index + 1] = value
      pixels.data[index + 2] = value
      pixels.data[index + 3] = 255
    }

    const nickname = document.createElement('canvas')
    nickname.width = slot.nickname.width
    nickname.height = slot.nickname.height
    const nicknameContext = nickname.getContext('2d')
    if (nicknameContext == null) {
      throw new Error('Could not create a party nickname canvas.')
    }
    nicknameContext.putImageData(pixels, 0, 0)

    return nickname
  })
}
