import { expect, it } from 'vitest'
import {
  PartyFrameGeometryError,
  detectPartyFrameGeometry,
  isValidPartyFrameSize
} from '@dfragon/lib'

type SyntheticTrack = {
  anchorX: number
  scale: number
  slot: 1 | 2 | 3 | 4
  hpWidth?: number
  mpWidth?: number
  withEdges?: boolean
  hpColor?: readonly [number, number, number]
  mpColor?: readonly [number, number, number]
  mpCenterOffsetPx?: number
  trackHeightPx?: number
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
    const defaultTrackHeight = scale >= 1.6 ? 2 : 3
    const trackHeight = track.trackHeightPx ?? defaultTrackHeight
    const hpCenter = 28 * scale
    const mpCenter = 34 * scale + (track.mpCenterOffsetPx ?? 0)
    const hpTop = Math.round(hpCenter - (trackHeight - 1) / 2)
    const mpTop = Math.round(mpCenter - (trackHeight - 1) / 2)
    const barWidth = Math.round(99 * scale)
    const hpWidth = track.hpWidth ?? barWidth
    const mpWidth = track.mpWidth ?? barWidth

    paintBand(rgba, width, anchorX, hpTop, hpWidth, trackHeight, track.hpColor ?? [194, 15, 11])
    paintBand(rgba, width, anchorX, mpTop, mpWidth, trackHeight, track.mpColor ?? [18, 124, 209])
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

it('merges equally distant color runs into the first active band', () => {
  const rgba = partyFrame({
    width: 1067,
    height: 600,
    tracks: [{ slot: 1, anchorX: 43, scale: 1 }]
  })
  paintBand(rgba, 1067, 40, 27, 108, 3, [176, 176, 176])
  paintBand(rgba, 1067, 42, 27, 99, 1, [194, 15, 11])
  paintBand(rgba, 1067, 46, 28, 99, 1, [194, 15, 11])
  paintBand(rgba, 1067, 44, 29, 99, 1, [194, 15, 11])

  const geometry = detect({ width: 1067, height: 600, rgba })

  expect(geometry.scale).toBe(1)
  expect(geometry.slots).toEqual([
    {
      slot: 1,
      x: 43,
      y: 10,
      width: 73,
      height: 16,
      coverage: { x: 42, y: 10, width: 101, height: 27 }
    }
  ])
})

it('projects slots in slot order using the median of their observed scales', () => {
  const rgba = partyFrame({
    width: 1067,
    height: 600,
    tracks: [
      { slot: 1, anchorX: 42, scale: 1.03 },
      { slot: 2, anchorX: 183, scale: 1 }
    ]
  })

  const geometry = detect({ width: 1067, height: 600, rgba })

  expect(geometry.scale).toBeCloseTo(1.015, 5)
  expect(
    geometry.slots.map(({ slot, x, y, width, height }) => ({ slot, x, y, width, height }))
  ).toEqual([
    { slot: 1, x: 42, y: 10, width: 74, height: 17 },
    { slot: 2, x: 183, y: 10, width: 74, height: 17 }
  ])
})

it('selects the largest scale cluster while leaving a smaller cluster out of the crops', () => {
  const rgba = partyFrame({
    width: 1920,
    height: 1080,
    tracks: [
      { slot: 1, anchorX: 42, scale: 1 },
      { slot: 2, anchorX: 183, scale: 1 },
      { slot: 3, anchorX: 583, scale: 1.8 }
    ]
  })

  const geometry = detect({ width: 1920, height: 1080, rgba })

  expect(geometry.scale).toBe(1)
  expect(geometry.slots.map(({ slot, x }) => ({ slot, x }))).toEqual([
    { slot: 1, x: 42 },
    { slot: 2, x: 183 }
  ])
})

it.each([
  [54, 235, 417, 598],
  [44, 215, 396, 577],
  [44, 225, 406, 588]
])('FHD 실측 앵커 %j의 네 크롭을 관측 위치에서 유지한다', (...anchors) => {
  const rgba = partyFrame({
    width: 1920,
    height: 1080,
    tracks: anchors.map((anchorX, index) => {
      const slot = (index + 1) as 1 | 2 | 3 | 4

      return { slot, anchorX, scale: 1.285714 }
    })
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
    tracks: anchors.map((anchorX, index) => {
      const slot = (index + 1) as 1 | 2 | 3 | 4

      return { slot, anchorX, scale: 1.285714 }
    })
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

it('리소스 한도를 넘는 크기와 잘못된 픽셀 버퍼를 거부한다', () => {
  expect(() => detect({ width: 8193, height: 600, rgba: Buffer.alloc(4) })).toThrowError(
    expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'invalid-frame' })
  )
  expect(() => detect({ width: 1067, height: 600, rgba: Buffer.alloc(4) })).toThrowError(
    expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'invalid-frame' })
  )
})

it.each([
  [800, 600],
  [1280, 720],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
  [3440, 1440],
  [5120, 1440]
])('%i×%i에서 해상도와 관계없이 같은 크기의 HUD 원본 좌표를 유지한다', (width, height) => {
  const rgba = partyFrame({
    width,
    height,
    tracks: [
      { slot: 2, anchorX: 183, scale: 1 },
      { slot: 4, anchorX: 465, scale: 1 }
    ]
  })

  const geometry = detect({ width, height, rgba })

  expect(geometry.scale).toBe(1)
  expect(
    geometry.slots.map(({ slot, x, y, width, height }) => ({ slot, x, y, width, height }))
  ).toEqual([
    { slot: 2, x: 183, y: 10, width: 73, height: 16 },
    { slot: 4, x: 465, y: 10, width: 73, height: 16 }
  ])
})

it.each([
  { width: 2560, height: 1440, scale: 2.4, anchorX: 1116, y: 26, cropWidth: 174, cropHeight: 33 },
  { width: 3840, height: 2160, scale: 3.6, anchorX: 1674, y: 41, cropWidth: 261, cropHeight: 48 },
  { width: 5120, height: 2160, scale: 3.6, anchorX: 1674, y: 41, cropWidth: 261, cropHeight: 48 }
])(
  '$width×$height의 $scale 배율 HUD에서 누락된 앞 슬롯을 채우지 않는다',
  ({ width, height, scale, anchorX, y, cropWidth, cropHeight }) => {
    const rgba = partyFrame({
      width,
      height,
      tracks: [{ slot: 4, anchorX, scale, trackHeightPx: 10 }]
    })

    const geometry = detect({ width, height, rgba })

    expect(geometry.scale).toBeCloseTo(scale, 2)
    expect(geometry.slots).toEqual([
      expect.objectContaining({ slot: 4, x: anchorX, y, width: cropWidth, height: cropHeight })
    ])
  }
)

it('4K에서도 지지하는 슬롯 수가 같은 서로 다른 배율을 거부한다', () => {
  const width = 3840
  const height = 2160
  const rgba = partyFrame({
    width,
    height,
    tracks: [
      { slot: 1, anchorX: 42, scale: 1 },
      { slot: 4, anchorX: 1674, scale: 3.6, trackHeightPx: 9 }
    ]
  })

  expect(() => detect({ width, height, rgba })).toThrowError(
    expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'ambiguous-scale' })
  )
})

it('버퍼 할당 전에 정수 크기와 축 및 총 픽셀 한도를 확인한다', () => {
  expect(isValidPartyFrameSize(1, 1)).toBe(true)
  expect(isValidPartyFrameSize(8192, 1)).toBe(true)
  expect(isValidPartyFrameSize(6000, 5500)).toBe(true)
  for (const [width, height] of [
    [0, 1080],
    [-1, 1080],
    [1920.5, 1080],
    [1920, NaN],
    [Infinity, 1080],
    [8193, 1],
    [1, 8193],
    [6000, 5501]
  ]) {
    expect(isValidPartyFrameSize(width, height)).toBe(false)
    expect(() => detect({ width, height, rgba: Buffer.alloc(4) })).toThrowError(
      expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'invalid-frame' })
    )
  }
})

it.each<{
  color: 'hp' | 'mp'
  pixels: readonly [number, number, number]
  accepted: boolean
}>([
  { color: 'hp', pixels: [109, 34, 54], accepted: false },
  { color: 'hp', pixels: [110, 35, 55], accepted: true },
  { color: 'hp', pixels: [111, 36, 56], accepted: true },
  { color: 'hp', pixels: [194, 120, 11], accepted: false },
  { color: 'hp', pixels: [194, 119, 11], accepted: true },
  { color: 'hp', pixels: [194, 118, 11], accepted: true },
  { color: 'hp', pixels: [194, 15, 140], accepted: false },
  { color: 'hp', pixels: [194, 15, 139], accepted: true },
  { color: 'hp', pixels: [194, 15, 138], accepted: true },
  { color: 'mp', pixels: [60, 60, 129], accepted: false },
  { color: 'mp', pixels: [60, 60, 130], accepted: true },
  { color: 'mp', pixels: [60, 60, 131], accepted: true },
  { color: 'mp', pixels: [145, 124, 209], accepted: false },
  { color: 'mp', pixels: [144, 124, 209], accepted: true },
  { color: 'mp', pixels: [143, 124, 209], accepted: true },
  { color: 'mp', pixels: [18, 178, 209], accepted: false },
  { color: 'mp', pixels: [18, 177, 209], accepted: true },
  { color: 'mp', pixels: [18, 176, 209], accepted: true },
  { color: 'mp', pixels: [18, 54, 130], accepted: false },
  { color: 'mp', pixels: [18, 55, 130], accepted: true },
  { color: 'mp', pixels: [18, 56, 130], accepted: true }
])('keeps $color channel boundary $pixels inclusive: $accepted', ({ color, pixels, accepted }) => {
  const track: SyntheticTrack = { slot: 1, anchorX: 42, scale: 1 }
  if (color === 'hp') {
    track.hpColor = pixels
  } else {
    track.mpColor = pixels
  }
  const rgba = partyFrame({ width: 1067, height: 600, tracks: [track] })

  if (accepted) {
    expect(detect({ width: 1067, height: 600, rgba }).slots[0]).toMatchObject({
      slot: 1,
      x: 42,
      y: 10,
      width: 73,
      height: 16
    })
  } else {
    expect(() => detect({ width: 1067, height: 600, rgba })).toThrowError(
      expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'no-anchor' })
    )
  }
})

it.each([77, 78, 79, 119, 120, 121])(
  'preserves the full-track width boundary at %i pixels',
  (width) => {
    const rgba = partyFrame({
      width: 1067,
      height: 600,
      // Keep the accepted scale at 1 so width does not select a neighboring scale.
      tracks: [
        { slot: 1, anchorX: 42, scale: 1, hpWidth: width, mpWidth: width, mpCenterOffsetPx: -1 }
      ]
    })

    if (width >= 78 && width <= 120) {
      expect(detect({ width: 1067, height: 600, rgba }).slots[0].x).toBe(42)
    } else {
      expect(() => detect({ width: 1067, height: 600, rgba })).toThrowError(
        expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'no-anchor' })
      )
    }
  }
)

it.each([2, 3])('preserves the color-run gap boundary at %i missing pixels', (gap) => {
  const rgba = partyFrame({
    width: 1067,
    height: 600,
    tracks: [{ slot: 1, anchorX: 42, scale: 1 }]
  })
  paintBand(rgba, 1067, 89, 27, gap, 3, [176, 176, 176])

  if (gap === 2) {
    expect(detect({ width: 1067, height: 600, rgba }).slots[0].x).toBe(42)
  } else {
    expect(() => detect({ width: 1067, height: 600, rgba })).toThrowError(
      expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'no-anchor' })
    )
  }
})

it.each([1, 2])('keeps paired center/gap tolerances when the MP center moves %ipx', (offset) => {
  const rgba = partyFrame({
    width: 1067,
    height: 600,
    tracks: [{ slot: 1, anchorX: 42, scale: 1, mpCenterOffsetPx: offset }]
  })

  if (offset === 1) {
    expect(detect({ width: 1067, height: 600, rgba }).slots[0].slot).toBe(1)
  } else {
    expect(() => detect({ width: 1067, height: 600, rgba })).toThrowError(
      expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'no-anchor' })
    )
  }
})

it.each([1.05, 1.06])('keeps the 0.055 scale-cluster boundary at scale %f', (secondScale) => {
  const rgba = partyFrame({
    width: 1067,
    height: 600,
    tracks: [
      { slot: 1, anchorX: 42, scale: 1 },
      { slot: 2, anchorX: 183, scale: secondScale, trackHeightPx: 2 }
    ]
  })

  if (secondScale === 1.05) {
    expect(detect({ width: 1067, height: 600, rgba }).slots.map(({ slot }) => slot)).toEqual([1, 2])
  } else {
    expect(() => detect({ width: 1067, height: 600, rgba })).toThrowError(
      expect.objectContaining<Partial<PartyFrameGeometryError>>({ reason: 'ambiguous-scale' })
    )
  }
})
