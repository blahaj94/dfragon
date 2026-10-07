import type { PartyFrameGeometry } from '@dfragon/lib'
import type { CharacterImage, CharacterPortrait } from '../../../preload/common/types/character'

export type PartyPortraitCropInput = Readonly<{
  frame: CharacterImage
  nicknameRegion: PartyFrameGeometry['slots'][number]
  rasterScale: number
}>
export type PartyPortraitCropper = (input: PartyPortraitCropInput) => CharacterPortrait | null

/** Windows 실측 자료로 후속 구현한다. 준비 전에는 얼굴이 없음을 반환하며 좌표를 추측하지 않는다. */
export const cropPartyPortrait: PartyPortraitCropper = () => null
