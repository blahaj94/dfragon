import type { Rgb } from '../types/capture'

/** 각 RGB 채널이 목표 색상의 허용 오차 안에 들어오는 픽셀이 하나라도 있는지 확인한다. */
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

/** OCR 문자열에서 한글, 영문, 숫자만 남겨 닉네임 비교에 사용할 값으로 정리한다. */
export function normalizeNickname(text: string): string {
  return text.replace(NICKNAME_COMPARISON_NOISE_PATTERN, '')
}
