import type { RaidFrameResult, WindowFrameResult } from '@dfragon/desktop-contracts/types/capture'
import type { CharacterImage } from '@dfragon/desktop-contracts/types/character'
import { cropRaidWindowNicknames } from '../lib/raid-window'

const RGBA_CHANNELS = 4
const ALPHA_CHANNEL = 3

/** 다른 창에 가려 GDI가 투명하게 제외한 픽셀이 있으면 그 닉네임은 읽지 않는다. */
function containsExcludedPixels(rgba: Uint8Array | Uint8ClampedArray): boolean {
  for (let index = ALPHA_CHANNEL; index < rgba.length; index += RGBA_CHANNELS) {
    if (rgba[index] === 0) {
      return true
    }
  }

  return false
}

/**
 * 공대 회차 프레임 한 장에서 12행 공대 상세 창을 찾아 화면 순서대로 12행의 닉네임 원본만 남긴다. 빈 행과
 * 가려진 행은 null이고, 창을 찾지 못하거나 후보가 모호하면 크롭을 만들지 않는다. 프레임 원본은 반환하지 않는다.
 */
export function toRaidFrameResult(result: WindowFrameResult): RaidFrameResult {
  if (result.kind !== 'frame') {
    return result
  }
  const detection = cropRaidWindowNicknames(result.image)
  if (detection.status === 'not-found') {
    return { kind: 'missing', reason: 'not-found' }
  }

  if (detection.status !== 'found') {
    return { kind: 'missing', reason: 'uncertain' }
  }
  const nicknames = detection.rows.map((row): CharacterImage | null => {
    const crop = row.nicknameCrop
    if (crop === null || containsExcludedPixels(crop.rgba)) {
      return null
    }
    const { width, height } = crop
    const rgba = Uint8Array.from(crop.rgba)

    return { width, height, rgba }
  })

  return { kind: 'rows', nicknames }
}
