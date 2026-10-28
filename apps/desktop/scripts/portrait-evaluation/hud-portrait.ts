import { cropPartyPortrait } from '../../src/frontend/src/lib/party-portrait'
import type { CharacterImage, CharacterPortrait } from '../../src/preload/common/types/character'

const RGBA_CHANNELS = 4
const OPAQUE_ALPHA = 255
// party-portrait.ts의 PORTRAIT_REGION과 같은 기준이다.
const HUD_FACE = { leftOfTrack: 28, top: 11, size: 26 } as const
const FRAME_PADDING = 8
const PADDING_PIXEL = [255, 0, 255, OPAQUE_ALPHA] as const

export function hudFaceSize(rasterScale: number): number {
  return Math.round(HUD_FACE.size * rasterScale)
}

export function buildHudPortrait(hud: CharacterImage, rasterScale: number): CharacterPortrait {
  const size = hudFaceSize(rasterScale)
  if (hud.width !== size || hud.height !== size) {
    throw new RangeError(
      `HUD 얼굴은 rasterScale ${rasterScale}에서 ${size}x${size}여야 하지만 ${hud.width}x${hud.height}입니다`
    )
  }
  const top = Math.round(HUD_FACE.top * rasterScale)
  // crop은 round(x - leftOfTrack * scale)를 왼쪽 끝으로 쓰므로 그 값이 FRAME_PADDING이 되는 정수 x를 고른다.
  const x = Math.ceil(FRAME_PADDING + HUD_FACE.leftOfTrack * rasterScale - 0.5)
  const width = FRAME_PADDING + size + FRAME_PADDING
  const height = top + size + FRAME_PADDING
  const rgba = new Uint8Array(width * height * RGBA_CHANNELS)
  for (let offset = 0; offset < rgba.length; offset += RGBA_CHANNELS) {
    rgba.set(PADDING_PIXEL, offset)
  }
  for (let row = 0; row < size; row += 1) {
    rgba.set(
      hud.rgba.subarray(row * size * RGBA_CHANNELS, (row + 1) * size * RGBA_CHANNELS),
      ((top + row) * width + FRAME_PADDING) * RGBA_CHANNELS
    )
  }
  const portrait = cropPartyPortrait({
    frame: { width, height, rgba },
    nicknameRegion: {
      slot: 1,
      x,
      y: 0,
      width: 1,
      height: 1,
      coverage: { x, y: 0, width: 1, height: 1 }
    },
    rasterScale
  })
  if (
    portrait == null ||
    portrait.image.width !== size ||
    portrait.image.height !== size ||
    !portrait.image.rgba.every((value, index) => value === hud.rgba[index])
  ) {
    throw new Error('HUD 얼굴을 패딩 프레임에서 같은 픽셀로 다시 읽지 못했습니다')
  }

  return portrait
}
