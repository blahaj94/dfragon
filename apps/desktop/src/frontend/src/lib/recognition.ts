import type { Rgb } from '../types/capture'

export function hasColorMatch(pixels: Iterable<Rgb>, target: Rgb, tolerance: number): boolean {
  for (const pixel of pixels) {
    const hasMatchingRed = Math.abs(pixel[0] - target[0]) <= tolerance
    if (!hasMatchingRed) {
      continue
    }

    const hasMatchingGreen = Math.abs(pixel[1] - target[1]) <= tolerance
    if (!hasMatchingGreen) {
      continue
    }

    const hasMatchingBlue = Math.abs(pixel[2] - target[2]) <= tolerance
    if (hasMatchingBlue) {
      return true
    }
  }

  return false
}

const NICKNAME_COMPARISON_NOISE_PATTERN = /[^\p{Script=Hangul}A-Za-z0-9]/gu

export function normalizeNickname(text: string): string {
  return text.replace(NICKNAME_COMPARISON_NOISE_PATTERN, '')
}
