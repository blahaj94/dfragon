import type { SearchObservation } from './search'
import type { CharacterImage } from './character'

export type CaptureSource = {
  id: string
  name: string
}

export type StableNicknameDetection = SearchObservation

export type WindowFrameResult =
  | { kind: 'frame'; image: CharacterImage; frameId?: string }
  | { kind: 'waiting'; reason: 'covered' | 'unavailable' }
  | { kind: 'unsupported' }

/**
 * 공대 캡처 회차의 프레임 결과. Main이 회차 프레임 한 장에서 12행 공대 상세 창을 찾아 화면 순서대로 12행의
 * 닉네임 원본만 전달한다. 빈 행과 가려져 읽을 수 없는 행은 null이며 프레임 원본은 renderer로 보내지 않는다.
 */
export type RaidFrameResult =
  | { kind: 'rows'; nicknames: readonly (CharacterImage | null)[] }
  | { kind: 'missing'; reason: 'not-found' | 'uncertain' }
  | Exclude<WindowFrameResult, { kind: 'frame' }>
