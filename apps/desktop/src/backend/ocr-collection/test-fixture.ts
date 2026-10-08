import type { CharacterImage } from '../../preload/common/types/character'

/** 독립 관측한 기본 배율의 HP, MP 앵커와 얼굴 위치를 그린다. */
export function partyFrame(): CharacterImage {
  const width = 1067
  const height = 600
  const rgba = new Uint8Array(width * height * 4)
  for (let index = 3; index < rgba.length; index += 4) {
    rgba[index] = 255
  }
  for (const anchor of [42, 183, 324, 465]) {
    for (let x = anchor; x < anchor + 99; x += 1) {
      for (let y = 27; y <= 29; y += 1) {
        rgba.set([194, 15, 11, 255], (y * width + x) * 4)
      }
      for (let y = 33; y <= 35; y += 1) {
        rgba.set([18, 124, 209, 255], (y * width + x) * 4)
      }
    }
    rgba.set([255, 190, 128, 255], (20 * width + anchor - 20) * 4)
    rgba.set([255, 255, 255, 255], (15 * width + anchor + 10) * 4)
  }

  return { width, height, rgba }
}
