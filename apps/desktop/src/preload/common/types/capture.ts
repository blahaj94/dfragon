import type { RaidValueColumn, SearchObservation } from './search'
import type { CharacterImage } from './character'

export type CaptureSource = {
  id: string
  name: string
}

export type StableNicknameDetection = SearchObservation

export type WindowFrameResult =
  | { kind: 'frame'; image: CharacterImage }
  | { kind: 'waiting'; reason: 'covered' | 'unavailable' }
  | { kind: 'unsupported' }

/** 공대 상세 창 한 행에서 main이 잘라 낸 원본과 읽은 수치 표기 */
export type RaidFrameRow = Readonly<{
  nickname: CharacterImage
  /** 직업명 칸 원본. 다른 창에 가려진 픽셀이 있으면 null이다. */
  job: CharacterImage | null
  /** 수치 칸에 보이는 그대로의 표기. 읽지 못했으면 null이다. */
  valueText: string | null
}>

/**
 * 공대 캡처 회차의 프레임 결과. Main이 회차 프레임 한 장에서 12행 공대 상세 창을 찾아 화면 순서대로 12행의
 * 닉네임, 직업명 원본과 수치 표기, 수치 열 종류를 전달한다. 빈 행과 닉네임이 가려져 읽을 수 없는 행은 null이며
 * 프레임 원본은 renderer로 보내지 않는다.
 */
export type RaidFrameResult =
  | { kind: 'rows'; valueColumn: RaidValueColumn; rows: readonly (RaidFrameRow | null)[] }
  | { kind: 'missing'; reason: 'not-found' | 'uncertain' }
  | Exclude<WindowFrameResult, { kind: 'frame' }>
