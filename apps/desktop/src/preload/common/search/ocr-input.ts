import type { CharacterPortrait } from '../types/character'
import type { OcrSearchInput, RaidRowObservation } from '../types/search'

const RGBA_CHANNELS = 4
const ALPHA_CHANNEL = 3

function sameCharacterPortrait(
  left: CharacterPortrait | null,
  right: CharacterPortrait | null
): boolean {
  if (left === null || right === null) {
    return left === right
  }

  if (
    left.rasterScale !== right.rasterScale ||
    left.image.width !== right.image.width ||
    left.image.height !== right.image.height
  ) {
    return false
  }
  const pixels = left.image.width * left.image.height
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const offset = pixel * RGBA_CHANNELS
    const leftValid = left.validMask?.[pixel] !== 0 && left.image.rgba[offset + ALPHA_CHANNEL] !== 0
    const rightValid =
      right.validMask?.[pixel] !== 0 && right.image.rgba[offset + ALPHA_CHANNEL] !== 0
    if (leftValid !== rightValid) {
      return false
    }

    if (!leftValid) {
      continue
    }

    for (let channel = 0; channel < ALPHA_CHANNEL; channel += 1) {
      if (left.image.rgba[offset + channel] !== right.image.rgba[offset + channel]) {
        return false
      }
    }
  }

  return true
}

function sameRaidRow(
  left: RaidRowObservation | undefined,
  right: RaidRowObservation | undefined
): boolean {
  if (left === undefined || right === undefined) {
    return left === right
  }

  return (
    left.jobText === right.jobText &&
    left.valueColumn === right.valueColumn &&
    left.valueText === right.valueText
  )
}

export function sameOcrSearchInput(left: OcrSearchInput, right: OcrSearchInput): boolean {
  if (left.candidateNicknames[0] !== right.candidateNicknames[0]) {
    return false
  }

  return (
    sameCharacterPortrait(left.portrait, right.portrait) && sameRaidRow(left.raidRow, right.raidRow)
  )
}
