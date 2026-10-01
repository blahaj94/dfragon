/** OCR 서버·브라우저·Desktop이 같은 이미지와 표본 계약을 검증한다. */
export const OCR_DATA_LIMITS = {
  maximumPngBytes: 16 * 1024 * 1024,
  maximumDimension: 8192,
  maximumPixels: 16_777_216,
  maximumCropsByKind: { hud: 4, participants: 4, raid: 12 },
  maximumUiScale: 10,
  maximumLabelLength: 100
} as const
