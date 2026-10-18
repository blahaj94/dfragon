import { fileURLToPath } from 'node:url'
import { expect, it, vi } from 'vitest'
import { captureParticipantWindow } from './participant-window'
import { previewFrame } from './collection-session'
import { raidFrame } from '../lib/raid-window-test-fixture'

vi.mock('../lib/raid-heading.png?asset', () => {
  const headingPath = fileURLToPath(new URL('../lib/raid-heading.png', import.meta.url))

  return { default: headingPath }
})

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
