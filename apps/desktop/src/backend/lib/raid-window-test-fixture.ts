import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'

/** 합성 창에 붙이는 실제 기준 헤더 경로 */
const RAID_HEADING_URL = new URL('./raid-heading.png', import.meta.url)

/**
 * 함께 보관한 UI 0% 기준 헤더를 붙인 1067×600 합성 공대 상세 창. 위에서부터 `count`개 행에 초상화, 레벨,
 * 역할 아이콘과 반투명 닉네임 획을 그린다. 실제 플레이어 정보는 들어 있지 않다.
 */
export function raidFrame(
  count: number,
  positions = [{ x: 300, y: 80 }]
): {
  width: number
  height: number
  rgba: Uint8Array
} {
  const width = 1067
  const height = 600
  // GDI 화면처럼 보이는 픽셀은 불투명하다. alpha 0은 다른 창에 가려 제외된 픽셀을 뜻한다.
  const rgba = new Uint8Array(width * height * 4)
  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    rgba[alpha] = 255
  }
  const reference = PNG.sync.read(readFileSync(RAID_HEADING_URL))
  if (reference.width !== 423 || reference.height !== 18) {
    throw new Error('The raid heading must be 423x18.')
  }
  const paint = (x: number, y: number, w: number, h: number, color: number[]): void => {
    for (let row = y; row < y + h; row += 1) {
      for (let column = x; column < x + w; column += 1) {
        rgba.set(color, (row * width + column) * 4)
      }
    }
  }
  for (const { x, y } of positions) {
    for (let row = 0; row < 18; row += 1) {
      rgba.set(
        reference.data.subarray(row * 423 * 4, (row + 1) * 423 * 4),
        ((y + 68 + row) * width + x + 15) * 4
      )
    }
    paint(x + 416, y + 54, 9, 9, [235, 20, 25, 255])
    for (let index = 0; index < count; index += 1) {
      const top = y + 86 + index * 21
      paint(x + 66, top + 3, 15, 14, [175, 175, 185, 255])
      paint(x + 100, top + 5, 16, 10, [180, 175, 145, 255])
      paint(x + 284, top + 3, 10, 13, [25, 150, 220, 255])
      paint(x + 207, top + 5, 60, 10, [190, 175 + index, 140, 128])
    }
  }

  return { width, height, rgba }
}
