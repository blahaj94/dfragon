import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { expect, it, vi } from 'vitest'
import { captureParticipantWindow } from './participant-window'
import { previewFrame } from './collection-session'

vi.mock('./raid-heading.png?asset', () => ({
  default: fileURLToPath(new URL('./raid-heading.png', import.meta.url))
}))

function raidFrame(
  count: number,
  positions = [{ x: 300, y: 80 }]
): {
  width: number
  height: number
  rgba: Uint8Array
} {
  const width = 1067
  const height = 600
  const rgba = new Uint8Array(width * height * 4)
  const reference = PNG.sync.read(readFileSync(new URL('./raid-heading.png', import.meta.url)))
  expect([reference.width, reference.height]).toEqual([423, 18])
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

it.each([10, 12])(
  'uses the shipped raid header and preserves %i raw crops with twelve preview rows',
  (count) => {
    const frame = raidFrame(count)
    const original = frame.rgba.slice()
    const result = captureParticipantWindow(frame, '2026-09-26T00:00:00.000Z', 'raid')
    expect(result.coverage).toEqual({ x: 300, y: 80, width: 465, height: 392 })
    expect(result.frame.slots.map(({ slot }) => slot)).toEqual(
      Array.from({ length: count }, (_, index) => index + 1)
    )
    const popup = result.frame.participantWindow!
    expect(popup.rows).toHaveLength(12)
    expect(popup.rows.map(({ occupied }) => occupied)).toEqual(
      Array.from({ length: 12 }, (_, index) => index < count)
    )
    expect(result.frame.original!.rgba.equals(Buffer.from(original))).toBe(true)
    for (const crop of result.frame.slots) {
      expect(popup.rows[crop.slot - 1]).toEqual({
        slot: crop.slot,
        occupied: true,
        x: 197,
        y: 89 + 21 * (crop.slot - 1),
        width: 86,
        height: 17
      })
      for (let row = 0; row < 17; row += 1) {
        const start = ((169 + 21 * (crop.slot - 1) + row) * frame.width + 497) * 4
        expect(new Uint8Array(crop.rgba.subarray(row * 344, (row + 1) * 344))).toEqual(
          original.subarray(start, start + 344)
        )
      }
    }
    expect(previewFrame(result.frame, 'raid')).not.toHaveProperty('original')
    expect(popup.rows[0]).not.toHaveProperty('party')
    expect(popup.rows[0]).not.toHaveProperty('equipmentScoreText')
    expect(Buffer.from(frame.rgba).equals(Buffer.from(original))).toBe(true)
    result.frame.slots[0].rgba.fill(0)
    expect(Buffer.from(frame.rgba).equals(Buffer.from(original))).toBe(true)
  }
)

it('returns raid-specific failure codes for absent and ambiguous windows', () => {
  expect(() =>
    captureParticipantWindow(
      { width: 1067, height: 600, rgba: new Uint8Array(1067 * 600 * 4) },
      '2026-09-26T00:00:00.000Z',
      'raid'
    )
  ).toThrow('DEVELOPER_RAID_WINDOW_NOT_FOUND')
  expect(() =>
    captureParticipantWindow(
      raidFrame(12, [
        { x: 20, y: 30 },
        { x: 580, y: 30 }
      ]),
      '2026-09-26T00:00:00.000Z',
      'raid'
    )
  ).toThrow('DEVELOPER_RAID_WINDOW_UNCERTAIN')
})
