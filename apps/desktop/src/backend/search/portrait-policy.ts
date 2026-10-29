import type { CharacterSelectionPolicy } from './identify'
import type { PortraitColorPolicy } from './portrait-color'

/** 후보가 둘 이상인 로컬 실표본 13건의 평가로 정한 기준. Windows 실시간 표본의 추가 검증이 필요하다. */
export const INITIAL_PORTRAIT_COLOR_POLICY = {
  gridSize: 8,
  minCoverage: 0.5,
  minComparedCells: 6,
  topFraction: 0.5,
  // 직업별 얼굴 위치를 HUD 캡처 한 건씩으로 잰 오차(±2px)를 흡수한다.
  anchorRadius: 2,
  maxDistance: 40,
  minMargin: 3,
  // 평가 표본에서 정답은 명성 4위 안이었다. 4슬롯이 직렬 큐를 공유해도 이미지 대기가 길어지지 않도록 서버 8곳 중 6명까지 비교한다.
  maxCandidates: 6
} as const satisfies PortraitColorPolicy & CharacterSelectionPolicy
