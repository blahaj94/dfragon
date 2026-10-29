import type { ScoreEngineInput } from './input'

// 엔진은 문서의 캐릭터 식별 칸을 확인한 뒤 thread마다 한 번 계산 초기화(약 1초)를 하므로, 식별 칸만 있는 문서로도
// 초기화가 끝난다. 직업은 버퍼여야 버프 계산기가 직업 판정에서 멈추지 않고 초기화까지 간다
// (dnfscore-native 0.3.1, macOS arm64 측정).
const header = {
  serverId: 'warmup',
  characterId: '00000000000000000000000000000000',
  characterName: 'warmup',
  level: 115,
  jobName: '아처',
  jobGrowName: '眞 뮤즈'
}

export const SCORE_WARMUP_INPUT: ScoreEngineInput = {
  status: header,
  equipment: header,
  avatar: header,
  creature: header,
  oath: header,
  mist_assimilation: header,
  skill_style: header,
  buff_equip_equipment: header,
  buff_equip_avatar: header,
  buff_equip_creature: header,
  items: {}
}
