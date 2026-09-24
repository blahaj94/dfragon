/**
 * Estimates the raster scale relative to the 600px-high, UI 0% reference.
 * Defaults to the original 1080px model, 225 / (225 - uiPercent).
 * Empirical candidate, not an official game formula or an image detector.
 * Fractional percentages are model interpolation, not verified game settings.
 * Scale an existing base raster; this does not prescribe a font size or rounding.
 * @throws {RangeError} If uiPercent is non-finite or outside [0, 100].
 * @throws {RangeError} If clientHeight is not an integer in [600, 1080].
 */
export function estimateDNFUIScale(uiPercent: number, clientHeight = 1080): number {
  if (!Number.isFinite(uiPercent) || uiPercent < 0 || uiPercent > 100) {
    throw new RangeError('DNF UI percent must be a finite number between 0 and 100.')
  }

  if (!Number.isInteger(clientHeight) || clientHeight < 600 || clientHeight > 1080) {
    throw new RangeError('DNF client height must be an integer between 600 and 1080.')
  }

  return clientHeight / (clientHeight - (clientHeight - 600) * (uiPercent / 100))
}
