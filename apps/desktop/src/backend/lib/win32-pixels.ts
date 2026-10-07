/** Windows BGRX 픽셀을 불투명한 RGBA 복사본으로 변환한다. */
export function bgrxToRgba(bgrx: Uint8Array): Buffer {
  if (bgrx.length % 4 !== 0) {
    throw new Error('BGRX data must contain whole 32-bit pixels.')
  }
  const rgba = Buffer.allocUnsafe(bgrx.length)
  for (let offset = 0; offset < bgrx.length; offset += 4) {
    rgba[offset] = bgrx[offset + 2]
    rgba[offset + 1] = bgrx[offset + 1]
    rgba[offset + 2] = bgrx[offset]
    rgba[offset + 3] = 255
  }

  return rgba
}
