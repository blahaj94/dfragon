/**
 * Estimates the raster scale relative to DNF UI 0% using 225 / (225 - uiPercent).
 * Empirical candidate supported by supplied captures at 0, 25, 50, 75 and 100%.
 * Not an official game formula; other settings/resolutions/DPI remain unverified.
 * Fractional percentages are model interpolation, not verified game settings.
 * Scale an existing base raster; this does not prescribe a font size or rounding.
 * @throws {RangeError} If uiPercent is non-finite or outside [0, 100].
 */
export function estimateDNFUIScale(uiPercent: number): number {
  if (!Number.isFinite(uiPercent) || uiPercent < 0 || uiPercent > 100) {
    throw new RangeError('DNF UI percent must be a finite number between 0 and 100.')
  }

  return 225 / (225 - uiPercent)
}
