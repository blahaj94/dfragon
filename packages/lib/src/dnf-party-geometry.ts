export type DNFRectangle = { x: number; y: number; width: number; height: number }

export type DNFPartyRegionOptions = {
  /** Actual captured game client dimensions, excluding desktop/window decorations. */
  clientSize: Readonly<{ width: number; height: number }>
  /** Caller-calibrated first-slot region in the 600px-high, UI 0% client reference. */
  baseRegion: Readonly<DNFRectangle>
  /** Observed raster scale; no UI percentage or settings file is required. */
  scale: number
  /** Translation in output client pixels, applied after scaling. Defaults to zero. */
  offset?: Readonly<{ x: number; y: number }>
}

const BASE_SLOT_SPACING = 141
const MAX_PARTY_SLOTS = 4

/** Estimates scale from corresponding anchors in two adjacent slots, not bar fill length. */
export function estimateDNFPartyScale(slotSpacing: number): number {
  if (!Number.isFinite(slotSpacing) || slotSpacing <= 0) {
    throw new RangeError('DNF adjacent slot spacing must produce a finite positive scale.')
  }
  const scale = slotSpacing / BASE_SLOT_SPACING
  if (scale === 0) {
    throw new RangeError('DNF adjacent slot spacing is too small to represent a positive scale.')
  }
  return scale
}

/**
 * Projects four candidate regions; it does not detect occupied slots or calibrate nickname bounds.
 * Scales each slot from reference coordinates, then rounds edges outward without clipping.
 * Slots 3/4 extrapolate the observed 1/2 spacing. Returns game-client-relative pixels.
 * @throws {RangeError} For invalid numeric inputs or any region outside the captured client.
 */
export function projectDNFPartyRegions({
  clientSize,
  baseRegion,
  scale,
  offset = { x: 0, y: 0 }
}: DNFPartyRegionOptions): DNFRectangle[] {
  if (
    !Number.isSafeInteger(clientSize.width) ||
    !Number.isSafeInteger(clientSize.height) ||
    clientSize.width <= 0 ||
    clientSize.height <= 0 ||
    !Number.isFinite(scale) ||
    scale <= 0 ||
    ![baseRegion.x, baseRegion.y, baseRegion.width, baseRegion.height, offset.x, offset.y].every(
      Number.isFinite
    ) ||
    baseRegion.x < 0 ||
    baseRegion.y < 0 ||
    baseRegion.width <= 0 ||
    baseRegion.height <= 0
  ) {
    throw new RangeError('DNF party geometry requires valid client dimensions, region and scale.')
  }

  return Array.from({ length: MAX_PARTY_SLOTS }, (_, index) => {
    const referenceX = baseRegion.x + index * BASE_SLOT_SPACING
    const left = Math.floor(offset.x + referenceX * scale)
    const top = Math.floor(offset.y + baseRegion.y * scale)
    const right = Math.ceil(offset.x + (referenceX + baseRegion.width) * scale)
    const bottom = Math.ceil(offset.y + (baseRegion.y + baseRegion.height) * scale)
    if (
      ![left, top, right, bottom].every(Number.isSafeInteger) ||
      left < 0 ||
      top < 0 ||
      right > clientSize.width ||
      bottom > clientSize.height ||
      right <= left ||
      bottom <= top
    ) {
      throw new RangeError('Projected DNF party regions must fit inside the client area.')
    }
    return { x: left, y: top, width: right - left, height: bottom - top }
  })
}
