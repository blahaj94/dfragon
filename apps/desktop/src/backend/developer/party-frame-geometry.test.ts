import { expect, it } from 'vitest'
import { PartyFrameGeometryError, detectPartyFrameGeometry } from './party-frame-geometry'

type SyntheticTrack = {
  anchorX: number
  scale: number
  slot: 1 | 2 | 3 | 4
  hpWidth?: number
  mpWidth?: number
  withEdges?: boolean
}

function partyFrame({
  width,
  height,
  tracks
}: {
  width: number
  height: number
  tracks: SyntheticTrack[]
}): Buffer {
  const rgba = Buffer.alloc(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4
    rgba[offset] = 176
    rgba[offset + 1] = 176
    rgba[offset + 2] = 176
    rgba[offset + 3] = 255
  }

  for (const track of tracks) {
    const { anchorX, scale } = track
    const trackHeight = scale >= 1.6 ? 2 : 3
    const hpCenter = 28 * scale
    const mpCenter = 34 * scale
    const hpTop = Math.round(hpCenter - (trackHeight - 1) / 2)
    const mpTop = Math.round(mpCenter - (trackHeight - 1) / 2)
    const barWidth = Math.round(99 * scale)
    const hpWidth = track.hpWidth ?? barWidth
    const mpWidth = track.mpWidth ?? barWidth

    paintBand(rgba, width, anchorX, hpTop, hpWidth, trackHeight, [194, 15, 11])
    paintBand(rgba, width, anchorX, mpTop, mpWidth, trackHeight, [18, 124, 209])
    if (track.withEdges !== false) {
      const margin = Math.max(1, Math.round(scale))
      const edgeWidth = Math.min(hpWidth, mpWidth) + margin * 2
      const edgeLeft = anchorX - margin
      const edgeRows = [
        hpTop - Math.round(scale),
        mpTop - Math.round(3 * scale),
        mpTop - Math.round(2 * scale),
        mpTop + trackHeight - 1 + Math.round(scale)
      ]
      for (const y of edgeRows) {
        paintBand(rgba, width, edgeLeft, y, edgeWidth, 1, [48, 48, 48])
      }
    }
  }
  return rgba
}

function paintBand(
  rgba: Buffer,
  width: number,
  left: number,
  top: number,
  bandWidth: number,
  bandHeight: number,
  color: readonly [number, number, number]
): void {
  for (let y = top; y < top + bandHeight; y += 1) {
    for (let x = left; x < left + bandWidth; x += 1) {
      const offset = (y * width + x) * 4
      rgba[offset] = color[0]
      rgba[offset + 1] = color[1]
      rgba[offset + 2] = color[2]
      rgba[offset + 3] = 255
    }
  }
}

function detect(frame: {
  width: number
  height: number
  rgba: Uint8Array
}): ReturnType<typeof detectPartyFrameGeometry> {
  return detectPartyFrameGeometry(frame)
}

it('detects a single full frame at the measured 1067×600 base geometry', () => {
  const rgba = partyFrame({
    width: 1067,
    height: 600,
    tracks: [{ slot: 1, anchorX: 42, scale: 1 }]
  })
  const geometry = detect({ width: 1067, height: 600, rgba })

  expect(geometry.scale).toBe(1)
  expect(geometry.slots).toEqual([
    {
      slot: 1,
      x: 42,
      y: 10,
      width: 73,
      height: 16,
      coverage: { x: 41, y: 10, width: 101, height: 27 }
    }
  ])
})

it('detects FHD UI 50-style bars and crops relative to each observed anchor', () => {
  const anchors = [54, 235, 417, 598]
  const rgba = partyFrame({
    width: 1920,
    height: 1080,
    tracks: anchors.map((anchorX, index) => ({
      slot: (index + 1) as 1 | 2 | 3 | 4,
      anchorX,
      scale: 1.285714
    }))
  })
  const geometry = detect({ width: 1920, height: 1080, rgba })

  expect(geometry.scale).toBeCloseTo(1.29, 2)
  expect(geometry.slots.map(({ slot }) => slot)).toEqual([1, 2, 3, 4])
  for (const [index, anchorX] of anchors.entries()) {
    expect(geometry.slots[index]).toMatchObject({
      x: anchorX,
      y: 13,
      width: 94,
      height: 20,
      coverage: { x: anchorX - 1, y: 13 }
    })
  }
})

it('preserves slot identities and local crop anchors with variable decoration spacing', () => {
  const anchors = [44, 215, 396, 577]
  const rgba = partyFrame({
    width: 1920,
    height: 1080,
    tracks: anchors.map((anchorX, index) => ({
      slot: (index + 1) as 1 | 2 | 3 | 4,
      anchorX,
      scale: 1.285714
    }))
  })
  const geometry = detect({ width: 1920, height: 1080, rgba })

  expect(geometry.slots.map(({ slot, x }) => [slot, x])).toEqual(
    anchors.map((anchorX, index) => [index + 1, anchorX])
  )
})

it('keeps slot 2 and 3 identities when slot 1 is absent', () => {
  const rgba = partyFrame({
    width: 1920,
    height: 1080,
    tracks: [
      { slot: 2, anchorX: 215, scale: 1.285714 },
      { slot: 3, anchorX: 396, scale: 1.285714 }
    ]
  })
  const geometry = detect({ width: 1920, height: 1080, rgba })

  expect(geometry.slots.map(({ slot }) => slot)).toEqual([2, 3])
  expect(geometry.slots.map(({ x }) => x)).toEqual([215, 396])
})

it('searches the upper measured scale endpoint without using bar width as scale', () => {
  const anchorX = 76
  const rgba = partyFrame({
    width: 1920,
    height: 1080,
    tracks: [{ slot: 1, anchorX, scale: 1.8, hpWidth: 175, mpWidth: 175 }]
  })
  const geometry = detect({ width: 1920, height: 1080, rgba })

  expect(geometry.scale).toBe(1.8)
  expect(geometry.slots[0]).toMatchObject({ x: 76, y: 19, width: 131, height: 26 })
})

it('does not treat partially filled bars as a complete party frame', () => {
  const rgba = partyFrame({
    width: 1920,
    height: 1080,
    tracks: [
      {
        slot: 1,
        anchorX: 54,
        scale: 1.285714,
        hpWidth: 55,
        mpWidth: 48
      }
    ]
  })

  expect(() => detect({ width: 1920, height: 1080, rgba })).toThrowError(
    expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'no-anchor' })
  )
})

it('rejects color pairs that lack paired local edge structure', () => {
  const rgba = partyFrame({
    width: 1067,
    height: 600,
    tracks: [{ slot: 1, anchorX: 42, scale: 1, withEdges: false }]
  })

  expect(() => detect({ width: 1067, height: 600, rgba })).toThrowError(
    expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'no-anchor' })
  )
})

it('fails closed when two equally plausible scale clusters remain', () => {
  const rgba = partyFrame({
    width: 1920,
    height: 1080,
    tracks: [
      { slot: 1, anchorX: 42, scale: 1 },
      { slot: 2, anchorX: 305, scale: 1.8 }
    ]
  })

  expect(() => detect({ width: 1920, height: 1080, rgba })).toThrowError(
    expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'ambiguous-scale' })
  )
})

it('fails closed for unsupported client sizes and malformed pixel buffers', () => {
  expect(() => detect({ width: 800, height: 600, rgba: Buffer.alloc(800 * 600 * 4) })).toThrowError(
    expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'invalid-frame' })
  )
  expect(() => detect({ width: 1067, height: 600, rgba: Buffer.alloc(4) })).toThrowError(
    expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'invalid-frame' })
  )
})
