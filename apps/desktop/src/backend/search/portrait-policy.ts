import type { PortraitEdgeMatchPolicy } from './portrait-edges'

/** 초기 게임 표본으로 정한 기준. Windows 실시간 표본의 추가 검증이 필요하다. */
export const INITIAL_PORTRAIT_EDGE_POLICY = {
  minSimilarity: 0.55,
  minCoverage: 0.8,
  minComparedPixels: 100
} as const satisfies PortraitEdgeMatchPolicy
