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
  | 'invalid-frame'
  | 'no-anchor'
  | 'ambiguous-scale'
  | 'ambiguous-layout'
  | 'out-of-bounds'

const MAX_FRAME_DIMENSION = 8192
const MAX_FRAME_PIXELS = 33_000_000
const REFERENCE_CLIENT_HEIGHT = 600
const MIN_SCALE = 1
const MEASURED_MAX_SCALE = 1.8
const SCALE_SEARCH_STEPS_PER_UNIT = 100
const SCALE_SEARCH_STEP = 1 / SCALE_SEARCH_STEPS_PER_UNIT
const NAME_VERTICAL_PADDING_PX = 2

// Measured from full HP/MP bars at 1067×600 and scaled client captures.
const HP_REFERENCE_CENTER_Y = 28
const MP_REFERENCE_CENTER_Y = 34
const TRACK_REFERENCE_CENTER_GAP = MP_REFERENCE_CENTER_Y - HP_REFERENCE_CENTER_Y
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

const trackColorPolicy = {
  hp: { minRed: 110, minRedGreenDifference: 75, minRedBlueDifference: 55 },
  mp: { minBlue: 130, minBlueRedDifference: 65, minBlueGreenDifference: 32, minGreen: 55 }
}
const bandPolicy = { minDistinctRows: 2, maxHeightPx: 8, minOverlapRatio: 0.55, maxColorGapPx: 2 }
const pairPolicy = {
  maxStartDifferencePx: 6,
  minCenterSeparationPx: 3,
  minLeftTolerancePx: 4,
  leftToleranceReferencePx: 2.5,
  maxCenterErrorPx: 1.25,
  maxGapErrorPx: 1.4,
  minWidthTolerancePx: 8,
  widthToleranceRatio: 0.09,
  gapErrorWeight: 0.5,
  edgeErrorWeight: 0.15,
  maxFittedScaleDifference: 0.04
}
const fullTrackPolicy = {
  minReferenceWidthPx: 78,
  maxReferenceWidthPx: 112,
  extraWidthTolerancePx: 8
}
const edgePolicy = {
  mpOuterTopOffsetReferencePx: 3,
  mpInnerTopOffsetReferencePx: 2,
  searchRadiusPx: 1,
  minDarkRatio: 0.3,
  minStrongRows: 2
}
const candidatePolicy = {
  maxDuplicateAnchorDifferencePx: 5,
  maxDuplicateCenterDifferencePx: 2,
  maxClusterScaleDifference: 0.055
}
const nameReferenceRegion = { topPx: 12, widthPx: 72.5, heightPx: 12 }

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

/** Validates allocation bounds without imposing a game resolution or aspect ratio. */
export function isValidPartyFrameSize(width: number, height: number): boolean {
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_FRAME_DIMENSION &&
    height <= MAX_FRAME_DIMENSION &&
    width * height <= MAX_FRAME_PIXELS
  )
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
    !isValidPartyFrameSize(width, height) ||
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

  const chosen = selectScaleCluster(candidates)
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

  const scale = medianCandidateScale([...bySlot.values()])
  const slots = projectObservedSlots({ bySlot, scale })

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
  // At maximum UI size the measured HUD grows with client height. This envelope
  // bounds discovery only; observed track centers still determine every crop.
  const searchScale = Math.max(MEASURED_MAX_SCALE, height / REFERENCE_CLIENT_HEIGHT)
  const searchExpansion = searchScale / MEASURED_MAX_SCALE
  const lastRow = Math.min(height - 1, Math.ceil(SEARCH_LAST_ROW * searchExpansion))
  const lastColumn = Math.min(width - 1, Math.ceil(SEARCH_LAST_COLUMN * searchExpansion))

  for (const color of ['hp', 'mp'] as const) {
    for (let y = SEARCH_FIRST_ROW; y <= lastRow; y += 1) {
      const referenceCenter = color === 'hp' ? HP_REFERENCE_CENTER_Y : MP_REFERENCE_CENTER_Y
      const expansion = Math.max(1, y / (referenceCenter * MEASURED_MAX_SCALE))
      const runs = findColoredRuns({ width, rgba, y, color, lastColumn, expansion })
      const active = bands.filter(
        (band) => band.color === color && y > band.bottom && y - band.bottom <= MAX_ROW_GAP_TO_MERGE
      )
      const used = new Set<TrackBand>()

      for (const run of runs) {
        const matchingBand = selectMatchingTrackBand({ active, run, used, expansion })

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

  return bands.filter(({ runs, top, bottom, centerY, color, medianWidth }) => {
    const distinctRows = new Set(runs.map(({ y }) => y)).size
    const referenceCenter = color === 'hp' ? HP_REFERENCE_CENTER_Y : MP_REFERENCE_CENTER_Y
    const expansion = Math.max(1, centerY / (referenceCenter * MEASURED_MAX_SCALE))

    return (
      distinctRows >= bandPolicy.minDistinctRows &&
      bottom - top + 1 <= Math.ceil(bandPolicy.maxHeightPx * expansion) &&
      medianWidth >= MIN_COLOR_RUN_WIDTH &&
      medianWidth <= MAX_COLOR_RUN_WIDTH * expansion
    )
  })
}

/** Select the closest unused band, retaining the first active band when distances tie. */
function selectMatchingTrackBand({
  active,
  run,
  used,
  expansion
}: {
  active: TrackBand[]
  run: PixelRun
  used: ReadonlySet<TrackBand>
  expansion: number
}): TrackBand | undefined {
  const matching = active
    .filter((band) => !used.has(band))
    .map((band) => {
      const distance = runDistance(band, run)

      return { band, distance }
    })
    .filter(({ band, distance }) => {
      const overlap = Math.max(
        0,
        Math.min(band.right, run.right) - Math.max(band.left, run.left) + 1
      )
      const overlapRatio = overlap / Math.min(band.right - band.left + 1, run.right - run.left + 1)

      return (
        distance <= MAX_RUN_START_DRIFT * expansion && overlapRatio >= bandPolicy.minOverlapRatio
      )
    })
    .sort((left, right) => left.distance - right.distance)[0]

  return matching?.band
}

function findColoredRuns({
  width,
  rgba,
  y,
  color,
  lastColumn,
  expansion
}: {
  width: number
  rgba: Uint8Array
  y: number
  color: TrackColor
  lastColumn: number
  expansion: number
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

    if (start >= 0 && x - lastColorPixel > Math.round(bandPolicy.maxColorGapPx * expansion)) {
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
    return (
      red >= trackColorPolicy.hp.minRed &&
      red - green >= trackColorPolicy.hp.minRedGreenDifference &&
      red - blue >= trackColorPolicy.hp.minRedBlueDifference
    )
  }

  return (
    blue >= trackColorPolicy.mp.minBlue &&
    blue - red >= trackColorPolicy.mp.minBlueRedDifference &&
    blue - green >= trackColorPolicy.mp.minBlueGreenDifference &&
    green >= trackColorPolicy.mp.minGreen
  )
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
      const pairScale = fitScaleToTrackCenters(hp, mp)
      const expansion = Math.max(1, pairScale / MEASURED_MAX_SCALE)
      if (
        Math.abs(hp.left - mp.left) > pairPolicy.maxStartDifferencePx * expansion ||
        Math.abs(hp.centerY - mp.centerY) < pairPolicy.minCenterSeparationPx
      ) {
        continue
      }

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
  const leftTolerance = Math.max(
    pairPolicy.minLeftTolerancePx,
    Math.round(pairPolicy.leftToleranceReferencePx * Math.max(MEASURED_MAX_SCALE, pairScale))
  )

  if (Math.abs(hp.left - mp.left) > leftTolerance) {
    return undefined
  }

  // Search only the neighborhood compatible with both observed centers, keeping
  // the original 0.01 raster grid and error tolerances at every resolution.
  const scaleTolerance = pairPolicy.maxCenterErrorPx / HP_REFERENCE_CENTER_Y
  const firstStep = Math.max(
    0,
    Math.ceil((pairScale - scaleTolerance - MIN_SCALE) / SCALE_SEARCH_STEP)
  )
  const maxScale = Math.max(MEASURED_MAX_SCALE, height / REFERENCE_CLIENT_HEIGHT)
  const lastStep = Math.floor(
    (Math.min(maxScale, pairScale + scaleTolerance) - MIN_SCALE) / SCALE_SEARCH_STEP
  )
  for (let step = firstStep; step <= lastStep; step += 1) {
    const scale = (MIN_SCALE * SCALE_SEARCH_STEPS_PER_UNIT + step) / SCALE_SEARCH_STEPS_PER_UNIT
    const hpError = Math.abs(hp.centerY - HP_REFERENCE_CENTER_Y * scale)
    const mpError = Math.abs(mp.centerY - MP_REFERENCE_CENTER_Y * scale)
    const gapError = Math.abs(mp.centerY - hp.centerY - TRACK_REFERENCE_CENTER_GAP * scale)
    if (
      hpError > pairPolicy.maxCenterErrorPx ||
      mpError > pairPolicy.maxCenterErrorPx ||
      gapError > pairPolicy.maxGapErrorPx
    ) {
      continue
    }

    if (!isFullTrackWidth(hp.medianWidth, scale) || !isFullTrackWidth(mp.medianWidth, scale)) {
      continue
    }

    if (
      Math.abs(hp.medianWidth - mp.medianWidth) >
      Math.max(
        pairPolicy.minWidthTolerancePx,
        pairPolicy.widthToleranceRatio * TRACK_REFERENCE_WIDTH * scale
      )
    ) {
      continue
    }

    const edgeSupport = scoreLocalEdgeTemplate({ width, height, rgba, hp, mp, anchorX, scale })
    if (edgeSupport.strongRows < edgePolicy.minStrongRows) {
      continue
    }
    const score =
      hpError +
      mpError +
      gapError * pairPolicy.gapErrorWeight +
      (1 - edgeSupport.mean) * pairPolicy.edgeErrorWeight
    if (!best || score < best.score) {
      best = { scale, score, edgeSupport: edgeSupport.mean }
    }
  }

  if (!best || Math.abs(best.scale - pairScale) > pairPolicy.maxFittedScaleDifference) {
    return undefined
  }

  return { scale: best.scale, edgeSupport: best.edgeSupport }
}

function isFullTrackWidth(width: number, scale: number): boolean {
  return (
    width >= fullTrackPolicy.minReferenceWidthPx * scale &&
    width <= fullTrackPolicy.maxReferenceWidthPx * scale + fullTrackPolicy.extraWidthTolerancePx
  )
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
    mp.top - Math.round(edgePolicy.mpOuterTopOffsetReferencePx * scale),
    mp.top - Math.round(edgePolicy.mpInnerTopOffsetReferencePx * scale),
    mp.bottom + Math.round(scale)
  ]
  const supports = rowTargets.map((targetY) => {
    let bestSupport = 0
    for (
      let y = targetY - edgePolicy.searchRadiusPx;
      y <= targetY + edgePolicy.searchRadiusPx;
      y += 1
    ) {
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
  const averageSupport = mean(supports)
  const strongRows = supports.filter((support) => support >= edgePolicy.minDarkRatio).length

  return { mean: averageSupport, strongRows }
}

function deduplicateCandidates(candidates: TrackPairCandidate[]): TrackPairCandidate[] {
  const unique: TrackPairCandidate[] = []
  for (const candidate of candidates.sort((left, right) => left.anchorX - right.anchorX)) {
    const duplicate = unique.find(
      (existing) =>
        Math.abs(existing.anchorX - candidate.anchorX) <=
          candidatePolicy.maxDuplicateAnchorDifferencePx &&
        Math.abs(existing.hp.centerY - candidate.hp.centerY) <=
          candidatePolicy.maxDuplicateCenterDifferencePx &&
        Math.abs(existing.mp.centerY - candidate.mp.centerY) <=
          candidatePolicy.maxDuplicateCenterDifferencePx
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
      (members) =>
        Math.abs(medianCandidateScale(members) - candidate.scale) <=
        candidatePolicy.maxClusterScaleDifference
    )
    if (cluster) {
      cluster.push(candidate)
    } else {
      clusters.push([candidate])
    }
  }

  return clusters
}

/** Keep all largest clusters long enough to reject an equally plausible scale. */
function selectScaleCluster(candidates: TrackPairCandidate[]): TrackPairCandidate[] {
  const clusters = clusterCandidatesByScale(candidates)
  const largestClusterSize = Math.max(...clusters.map((cluster) => cluster.length))
  const bestClusters = clusters.filter((cluster) => cluster.length === largestClusterSize)
  if (bestClusters.length !== 1) {
    throw new PartyFrameGeometryError('ambiguous-scale')
  }

  return bestClusters[0]
}

/** Aggregate scale values without changing the candidate objects or their order. */
function medianCandidateScale(candidates: TrackPairCandidate[]): number {
  const scale = median(candidates.map(({ scale }) => scale))

  return scale
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
  if (matches.length === 1) {
    return matches[0]
  }

  return undefined
}

/** Project only identified observations and return them in slot-number order. */
function projectObservedSlots({
  bySlot,
  scale
}: {
  bySlot: ReadonlyMap<PartyFrameSlot, TrackPairCandidate>
  scale: number
}): PartyFrameRegion[] {
  const slots = [...bySlot.entries()]
    .map(([slot, candidate]) => projectObservedSlot({ slot, candidate, scale }))
    .sort((left, right) => left.slot - right.slot)

  return slots
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
  // A measured base-scale glyph starts at anchor+1 and reaches y=22. Keep the
  // observed left anchor and add two captured pixels above/below the scaled name line.
  // The name target excludes the right-side status icon. Maximum name width is unverified.
  const x = anchorX
  const y = Math.floor(nameReferenceRegion.topPx * scale) - NAME_VERTICAL_PADDING_PX
  const width = Math.ceil(nameReferenceRegion.widthPx * scale)
  const height = Math.ceil(nameReferenceRegion.heightPx * scale) + 2 * NAME_VERTICAL_PADDING_PX

  const trackMargin = Math.max(1, Math.round(scale))
  const trackWidth = Math.round(Math.min(hp.medianWidth, mp.medianWidth))
  const coverageLeft = Math.min(x, anchorX - trackMargin)
  const coverageRight = Math.max(x + width, anchorX + trackWidth + trackMargin)
  const coverageBottom = Math.max(y + height, mp.bottom + trackMargin + 1)
  const coverageWidth = coverageRight - coverageLeft
  const coverageHeight = coverageBottom - y

  return {
    slot,
    x,
    y,
    width,
    height,
    coverage: {
      x: coverageLeft,
      y,
      width: coverageWidth,
      height: coverageHeight
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
  const result =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]

  return result
}

function mean(values: number[]): number {
  const result = values.reduce((total, value) => total + value, 0) / values.length

  return result
}
