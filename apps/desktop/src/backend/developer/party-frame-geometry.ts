export type PartyFrameSlot = 1 | 2 | 3 | 4

export type PartyFrameRegion = {
  slot: PartyFrameSlot
  x: number
  y: number
  width: number
  height: number
  coverage: { x: number; y: number; width: number; height: number }
}

export type PartyFrameGeometry = {
  /** Detected raster scale relative to the measured 1067×600 party-frame geometry. */
  scale: number
  slots: PartyFrameRegion[]
}

export type PartyFramePixels = Readonly<{
  width: number
  height: number
  rgba: Uint8Array
}>

export type PartyFrameGeometryFailureReason =
  'invalid-frame' | 'no-anchor' | 'ambiguous-scale' | 'ambiguous-layout' | 'out-of-bounds'

const MIN_CLIENT_WIDTH = 1067
const MAX_CLIENT_WIDTH = 1920
const MIN_CLIENT_HEIGHT = 600
const MAX_CLIENT_HEIGHT = 1080
const MIN_SCALE = 1
const MAX_SCALE = 1.8
const SCALE_SEARCH_STEP = 0.01

// Measured from full HP/MP bars at 1067×600 and scaled client captures.
const HP_REFERENCE_CENTER_Y = 28
const MP_REFERENCE_CENTER_Y = 34
const TRACK_REFERENCE_WIDTH = 99
const FIRST_TRACK_REFERENCE_X = 42
const REFERENCE_SLOT_SPACING = 141

// This window is used only to identify the actual slot number. Crops always use observed x.
// Broad, non-overlapping identity windows tolerate decorations and raster rounding.
// These windows identify missing slots; they never supply an unobserved crop coordinate.
const SLOT_IDENTITY_HALF_WINDOW = REFERENCE_SLOT_SPACING / 3

const SEARCH_FIRST_ROW = 12
const SEARCH_LAST_ROW = 90
const SEARCH_FIRST_COLUMN = 16
const SEARCH_LAST_COLUMN = 1200
const MIN_COLOR_RUN_WIDTH = 72
const MAX_COLOR_RUN_WIDTH = 240
const MAX_ROW_GAP_TO_MERGE = 2
const MAX_RUN_START_DRIFT = 6
const DARK_CHANNEL_LIMIT = 110

type TrackColor = 'hp' | 'mp'

type PixelRun = {
  y: number
  left: number
  right: number
}

type TrackBand = {
  color: TrackColor
  runs: PixelRun[]
  left: number
  right: number
  top: number
  bottom: number
  centerY: number
  medianWidth: number
}

type TrackPairCandidate = {
  anchorX: number
  scale: number
  edgeSupport: number
  hp: TrackBand
  mp: TrackBand
}

/** A capture that cannot be placed confidently must not be stored as a party sample. */
export class PartyFrameGeometryError extends Error {
  constructor(readonly reason: PartyFrameGeometryFailureReason) {
    const messages: Record<PartyFrameGeometryFailureReason, string> = {
      'invalid-frame': 'The captured DNF client frame has an unsupported size or pixel buffer.',
      'no-anchor': 'A full paired HP and MP party frame could not be detected.',
      'ambiguous-scale': 'More than one plausible party-frame scale was detected.',
      'ambiguous-layout': 'A party frame could not be assigned to one slot with confidence.',
      'out-of-bounds': 'A detected party-frame crop does not fit inside the captured client area.'
    }
    super(messages[reason])
    this.name = 'PartyFrameGeometryError'
  }
}

/**
 * Finds full paired HP/MP bars, checks their local edge structure, and crops the name line
 * relative to each observed bar. The scale search is based on measured track row centers;
 * client dimensions, UI percentages, and repeated-slot spacing do not position the crops.
 */
export function detectPartyFrameGeometry({
  width,
  height,
  rgba
}: PartyFramePixels): PartyFrameGeometry {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < MIN_CLIENT_WIDTH ||
    width > MAX_CLIENT_WIDTH ||
    height < MIN_CLIENT_HEIGHT ||
    height > MAX_CLIENT_HEIGHT ||
    !(rgba instanceof Uint8Array) ||
    rgba.byteLength !== width * height * 4
  ) {
    throw new PartyFrameGeometryError('invalid-frame')
  }

  const bands = findTrackBands({ width, height, rgba })
  const candidates = deduplicateCandidates(findTrackPairCandidates({ width, height, rgba, bands }))
  if (candidates.length === 0) {
    throw new PartyFrameGeometryError('no-anchor')
  }

  const scaleClusters = clusterCandidatesByScale(candidates)
  const largestClusterSize = Math.max(...scaleClusters.map((cluster) => cluster.length))
  const bestClusters = scaleClusters.filter((cluster) => cluster.length === largestClusterSize)
  if (bestClusters.length !== 1) {
    throw new PartyFrameGeometryError('ambiguous-scale')
  }

  const chosen = bestClusters[0]
  const bySlot = new Map<PartyFrameSlot, TrackPairCandidate>()
  for (const candidate of chosen) {
    const slot = identifySlot(candidate.anchorX, candidate.scale)
    if (slot == null) {
      continue
    }
    if (bySlot.has(slot)) {
      throw new PartyFrameGeometryError('ambiguous-layout')
    }
    bySlot.set(slot, candidate)
  }
  if (bySlot.size === 0) {
    throw new PartyFrameGeometryError('no-anchor')
  }

  const scale = median([...bySlot.values()].map(({ scale: candidateScale }) => candidateScale))
  const slots = [...bySlot.entries()]
    .map(([slot, candidate]) => projectObservedSlot({ slot, candidate, scale }))
    .sort((left, right) => left.slot - right.slot)

  if (
    slots.some(
      ({ x, y, width: cropWidth, height: cropHeight, coverage }) =>
        !isInsideFrame({ x, y, width: cropWidth, height: cropHeight }, width, height) ||
        !isInsideFrame(coverage, width, height)
    )
  ) {
    throw new PartyFrameGeometryError('out-of-bounds')
  }

  return { scale, slots }
}

function findTrackBands({ width, height, rgba }: PartyFramePixels): TrackBand[] {
  const bands: TrackBand[] = []
  const lastRow = Math.min(height - 1, SEARCH_LAST_ROW)
  const lastColumn = Math.min(width - 1, SEARCH_LAST_COLUMN)

  for (const color of ['hp', 'mp'] as const) {
    for (let y = SEARCH_FIRST_ROW; y <= lastRow; y += 1) {
      const runs = findColoredRuns({ width, rgba, y, color, lastColumn })
      const active = bands.filter(
        (band) => band.color === color && y > band.bottom && y - band.bottom <= MAX_ROW_GAP_TO_MERGE
      )
      const used = new Set<TrackBand>()

      for (const run of runs) {
        const matchingBand = active
          .filter((band) => !used.has(band))
          .map((band) => ({ band, distance: runDistance(band, run) }))
          .filter(({ band, distance }) => {
            const overlap = Math.max(
              0,
              Math.min(band.right, run.right) - Math.max(band.left, run.left) + 1
            )
            const overlapRatio =
              overlap / Math.min(band.right - band.left + 1, run.right - run.left + 1)
            return distance <= MAX_RUN_START_DRIFT && overlapRatio >= 0.55
          })
          .sort((left, right) => left.distance - right.distance)[0]?.band

        if (matchingBand) {
          matchingBand.runs.push(run)
          updateBand(matchingBand)
          used.add(matchingBand)
        } else {
          const band: TrackBand = {
            color,
            runs: [run],
            left: run.left,
            right: run.right,
            top: y,
            bottom: y,
            centerY: y,
            medianWidth: run.right - run.left + 1
          }
          bands.push(band)
          used.add(band)
        }
      }
    }
  }

  return bands.filter(({ runs, top, bottom, medianWidth }) => {
    const distinctRows = new Set(runs.map(({ y }) => y)).size
    return (
      distinctRows >= 2 &&
      bottom - top + 1 <= 8 &&
      medianWidth >= MIN_COLOR_RUN_WIDTH &&
      medianWidth <= MAX_COLOR_RUN_WIDTH
    )
  })
}

function findColoredRuns({
  width,
  rgba,
  y,
  color,
  lastColumn
}: {
  width: number
  rgba: Uint8Array
  y: number
  color: TrackColor
  lastColumn: number
}): PixelRun[] {
  const runs: PixelRun[] = []
  let start = -1
  let lastColorPixel = -1

  for (let x = SEARCH_FIRST_COLUMN; x <= lastColumn + 1; x += 1) {
    const found = x <= lastColumn && isTrackColor(rgba, width, x, y, color)
    if (found) {
      if (start < 0) {
        start = x
      }
      lastColorPixel = x
      continue
    }

    if (start >= 0 && x - lastColorPixel > 2) {
      if (lastColorPixel - start + 1 >= MIN_COLOR_RUN_WIDTH) {
        runs.push({ y, left: start, right: lastColorPixel })
      }
      start = -1
      lastColorPixel = -1
    }
  }

  if (start >= 0 && lastColorPixel - start + 1 >= MIN_COLOR_RUN_WIDTH) {
    runs.push({ y, left: start, right: lastColorPixel })
  }
  return runs
}

function isTrackColor(
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
  color: TrackColor
): boolean {
  const offset = (y * width + x) * 4
  const red = rgba[offset]
  const green = rgba[offset + 1]
  const blue = rgba[offset + 2]
  if (color === 'hp') {
    return red >= 110 && red - green >= 75 && red - blue >= 55
  }
  return blue >= 130 && blue - red >= 65 && blue - green >= 32 && green >= 55
}

function findTrackPairCandidates({
  width,
  height,
  rgba,
  bands
}: PartyFramePixels & { bands: TrackBand[] }): TrackPairCandidate[] {
  const hpBands = bands.filter((band) => band.color === 'hp')
  const mpBands = bands.filter((band) => band.color === 'mp')
  const candidates: TrackPairCandidate[] = []

  for (const hp of hpBands) {
    for (const mp of mpBands) {
      if (Math.abs(hp.left - mp.left) > 6 || Math.abs(hp.centerY - mp.centerY) < 3) {
        continue
      }

      const pairScale = fitScaleToTrackCenters(hp, mp)
      if (!Number.isFinite(pairScale)) {
        continue
      }
      const anchorX = Math.floor(Math.min(hp.left, mp.left))
      const fit = findScaleMatch({ width, height, rgba, hp, mp, anchorX, pairScale })
      if (fit) {
        candidates.push({ anchorX, scale: fit.scale, edgeSupport: fit.edgeSupport, hp, mp })
      }
    }
  }
  return candidates
}

function fitScaleToTrackCenters(hp: TrackBand, mp: TrackBand): number {
  return (
    (hp.centerY * HP_REFERENCE_CENTER_Y + mp.centerY * MP_REFERENCE_CENTER_Y) /
    (HP_REFERENCE_CENTER_Y ** 2 + MP_REFERENCE_CENTER_Y ** 2)
  )
}

function findScaleMatch({
  width,
  height,
  rgba,
  hp,
  mp,
  anchorX,
  pairScale
}: PartyFramePixels & {
  hp: TrackBand
  mp: TrackBand
  anchorX: number
  pairScale: number
}): { scale: number; edgeSupport: number } | undefined {
  let best: { scale: number; score: number; edgeSupport: number } | undefined
  const leftTolerance = Math.max(4, Math.round(2.5 * MAX_SCALE))

  if (Math.abs(hp.left - mp.left) > leftTolerance) {
    return undefined
  }

  for (let step = 0; step <= Math.round((MAX_SCALE - MIN_SCALE) / SCALE_SEARCH_STEP); step += 1) {
    const scale = MIN_SCALE + step * SCALE_SEARCH_STEP
    const hpError = Math.abs(hp.centerY - HP_REFERENCE_CENTER_Y * scale)
    const mpError = Math.abs(mp.centerY - MP_REFERENCE_CENTER_Y * scale)
    const gapError = Math.abs(mp.centerY - hp.centerY - 6 * scale)
    if (hpError > 1.25 || mpError > 1.25 || gapError > 1.4) {
      continue
    }
    if (!isFullTrackWidth(hp.medianWidth, scale) || !isFullTrackWidth(mp.medianWidth, scale)) {
      continue
    }
    if (
      Math.abs(hp.medianWidth - mp.medianWidth) > Math.max(8, 0.09 * TRACK_REFERENCE_WIDTH * scale)
    ) {
      continue
    }

    const edgeSupport = scoreLocalEdgeTemplate({ width, height, rgba, hp, mp, anchorX, scale })
    if (edgeSupport.strongRows < 2) {
      continue
    }
    const score = hpError + mpError + gapError * 0.5 + (1 - edgeSupport.mean) * 0.15
    if (!best || score < best.score) {
      best = { scale, score, edgeSupport: edgeSupport.mean }
    }
  }

  if (!best || Math.abs(best.scale - pairScale) > 0.04) {
    return undefined
  }
  return { scale: best.scale, edgeSupport: best.edgeSupport }
}

function isFullTrackWidth(width: number, scale: number): boolean {
  return width >= 78 * scale && width <= 112 * scale + 8
}

function scoreLocalEdgeTemplate({
  width,
  height,
  rgba,
  hp,
  mp,
  anchorX,
  scale
}: PartyFramePixels & {
  hp: TrackBand
  mp: TrackBand
  anchorX: number
  scale: number
}): { mean: number; strongRows: number } {
  const templateWidth = Math.max(1, Math.round(Math.min(hp.medianWidth, mp.medianWidth)))
  const edgeWidth = templateWidth + 2 * Math.max(1, Math.round(scale))
  const edgeLeft = anchorX - Math.max(1, Math.round(scale))
  const rowTargets = [
    hp.top - Math.round(scale),
    mp.top - Math.round(3 * scale),
    mp.top - Math.round(2 * scale),
    mp.bottom + Math.round(scale)
  ]
  const supports = rowTargets.map((targetY) => {
    let bestSupport = 0
    for (let y = targetY - 1; y <= targetY + 1; y += 1) {
      if (y < 0 || y >= height || edgeLeft < 0 || edgeLeft + edgeWidth > width) {
        continue
      }
      let darkPixels = 0
      for (let x = edgeLeft; x < edgeLeft + edgeWidth; x += 1) {
        const offset = (y * width + x) * 4
        if (
          rgba[offset] < DARK_CHANNEL_LIMIT &&
          rgba[offset + 1] < DARK_CHANNEL_LIMIT &&
          rgba[offset + 2] < DARK_CHANNEL_LIMIT
        ) {
          darkPixels += 1
        }
      }
      bestSupport = Math.max(bestSupport, darkPixels / edgeWidth)
    }
    return bestSupport
  })
  return {
    mean: mean(supports),
    strongRows: supports.filter((support) => support >= 0.3).length
  }
}

function deduplicateCandidates(candidates: TrackPairCandidate[]): TrackPairCandidate[] {
  const unique: TrackPairCandidate[] = []
  for (const candidate of candidates.sort((left, right) => left.anchorX - right.anchorX)) {
    const duplicate = unique.find(
      (existing) =>
        Math.abs(existing.anchorX - candidate.anchorX) <= 5 &&
        Math.abs(existing.hp.centerY - candidate.hp.centerY) <= 2 &&
        Math.abs(existing.mp.centerY - candidate.mp.centerY) <= 2
    )
    if (!duplicate) {
      unique.push(candidate)
      continue
    }
    if (candidate.edgeSupport > duplicate.edgeSupport) {
      Object.assign(duplicate, candidate)
    }
  }
  return unique
}

function clusterCandidatesByScale(candidates: TrackPairCandidate[]): TrackPairCandidate[][] {
  const clusters: TrackPairCandidate[][] = []
  for (const candidate of [...candidates].sort((left, right) => left.scale - right.scale)) {
    const cluster = clusters.find(
      (members) => Math.abs(median(members.map(({ scale }) => scale)) - candidate.scale) <= 0.055
    )
    if (cluster) {
      cluster.push(candidate)
    } else {
      clusters.push([candidate])
    }
  }
  return clusters
}

function identifySlot(anchorX: number, scale: number): PartyFrameSlot | undefined {
  const baseX = anchorX / scale
  const matches: PartyFrameSlot[] = []
  for (let index = 0; index < 4; index += 1) {
    const expectedX = FIRST_TRACK_REFERENCE_X + index * REFERENCE_SLOT_SPACING
    if (
      baseX >= expectedX - SLOT_IDENTITY_HALF_WINDOW &&
      baseX <= expectedX + SLOT_IDENTITY_HALF_WINDOW
    ) {
      matches.push((index + 1) as PartyFrameSlot)
    }
  }
  return matches.length === 1 ? matches[0] : undefined
}

function projectObservedSlot({
  slot,
  candidate,
  scale
}: {
  slot: PartyFrameSlot
  candidate: TrackPairCandidate
  scale: number
}): PartyFrameRegion {
  const { anchorX, hp, mp } = candidate
  // A measured base-scale glyph starts at anchor+1 and reaches y=22. Keep one
  // pixel of left/bottom padding; the earlier anchor+2 crop clipped its first column.
  // The name target excludes the right-side status icon. Maximum name width is unverified.
  const x = anchorX
  const y = Math.floor(12 * scale)
  const width = Math.ceil(72.5 * scale)
  const height = Math.ceil(12 * scale)

  const trackMargin = Math.max(1, Math.round(scale))
  const trackWidth = Math.round(Math.min(hp.medianWidth, mp.medianWidth))
  const coverageLeft = Math.min(x, anchorX - trackMargin)
  const coverageRight = Math.max(x + width, anchorX + trackWidth + trackMargin)
  const coverageBottom = Math.max(y + height, mp.bottom + trackMargin + 1)

  return {
    slot,
    x,
    y,
    width,
    height,
    coverage: {
      x: coverageLeft,
      y,
      width: coverageRight - coverageLeft,
      height: coverageBottom - y
    }
  }
}

function isInsideFrame(
  rect: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number
): boolean {
  return (
    Number.isSafeInteger(rect.x) &&
    Number.isSafeInteger(rect.y) &&
    Number.isSafeInteger(rect.width) &&
    Number.isSafeInteger(rect.height) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= frameWidth &&
    rect.y + rect.height <= frameHeight
  )
}

function updateBand(band: TrackBand): void {
  band.left = median(band.runs.map(({ left }) => left))
  band.right = median(band.runs.map(({ right }) => right))
  band.top = Math.min(...band.runs.map(({ y }) => y))
  band.bottom = Math.max(...band.runs.map(({ y }) => y))
  band.centerY = (band.top + band.bottom) / 2
  band.medianWidth = median(band.runs.map(({ left, right }) => right - left + 1))
}

function runDistance(band: TrackBand, run: PixelRun): number {
  return Math.abs(run.left - band.left) + Math.abs(run.right - band.right)
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
