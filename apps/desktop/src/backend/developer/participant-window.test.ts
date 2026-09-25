import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { expect, it, vi } from 'vitest'
import { captureParticipantWindow } from './participant-window'

// Electron Vite emits this asset beside the main bundle; Vitest reads the source PNG.
vi.mock('./participant-heading.png?asset', () => ({
  default: fileURLToPath(new URL('./participant-heading.png', import.meta.url))
}))

it('uses the shipped heading and preserves slot 3, popup-relative bounds and raw bytes', () => {
  const width = 1067
  const height = 600
  const rgba = new Uint8Array(width * height * 4)
  const reference = PNG.sync.read(
    readFileSync(new URL('./participant-heading.png', import.meta.url))
  )
  expect([reference.width, reference.height]).toEqual([368, 17])
  const heading = reference.data
  const x = 300
  const y = 160
  const paint = (left: number, top: number, w: number, h: number, color: number[]): void => {
    for (let row = top; row < top + h; row += 1) {
      for (let column = left; column < left + w; column += 1) {
        rgba.set(color, (row * width + column) * 4)
      }
    }
  }
  for (let row = 0; row < 17; row += 1) {
    rgba.set(
      heading.subarray(row * 368 * 4, (row + 1) * 368 * 4),
      ((y + 67 + row) * width + x + 14) * 4
    )
  }
  paint(x + 370, y + 48, 9, 9, [235, 20, 25, 255])
  for (const slot of [1, 2, 4]) {
    paint(x + 194, y + 89 + (slot - 1) * 22, 9, 10, [210, 175, 75, 255])
  }
  paint(x + 46, y + 131, 15, 14, [175, 175, 185, 255])
  paint(x + 67, y + 133, 13, 10, [180, 175, 145, 255])
  paint(x + 257, y + 131, 10, 13, [25, 150, 220, 255])
  paint(x + 178, y + 133, 60, 10, [190, 175, 140, 128])
  const original = rgba.slice()
  const result = captureParticipantWindow({ width, height, rgba }, '2026-09-25T00:00:00.000Z')
  expect(result.coverage).toEqual({ x, y, width: 394, height: 210 })
  expect(result.frame.slots.map(({ slot }) => slot)).toEqual([3])
  expect(result.frame.original?.rgba.equals(Buffer.from(original))).toBe(true)
  expect(result.frame.original?.crops).toEqual([
    { slot: 3, x: x + 168, y: y + 131, width: 84, height: 15 }
  ])
  const popup = result.frame.participantWindow!
  expect(popup.rows.map(({ occupied }) => occupied)).toEqual([false, false, true, false])
  expect(popup.rows[2]).toEqual({ slot: 3, occupied: true, x: 168, y: 131, width: 84, height: 15 })
  for (let row = 0; row < 210; row += 1) {
    const start = ((y + row) * width + x) * 4
    expect(popup.rgba.subarray(row * 394 * 4, (row + 1) * 394 * 4)).toEqual(
      original.subarray(start, start + 394 * 4)
    )
  }
  for (let row = 0; row < 15; row += 1) {
    const start = ((y + 131 + row) * width + x + 168) * 4
    expect(
      new Uint8Array(result.frame.slots[0].rgba.subarray(row * 84 * 4, (row + 1) * 84 * 4))
    ).toEqual(original.subarray(start, start + 84 * 4))
  }
  expect(rgba).toEqual(original)
})

it('does not return preview pixels for an absent popup', () => {
  expect(() =>
    captureParticipantWindow(
      { width: 1067, height: 600, rgba: new Uint8Array(1067 * 600 * 4) },
      '2026-09-25T00:00:00.000Z'
    )
  ).toThrow('DEVELOPER_PARTICIPANT_WINDOW_NOT_FOUND')
})
