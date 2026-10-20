import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

// 묵언의 진의 칸이 옵션 종류(lib/card-faces의 UpgradeCellView kind)로 고르는 면. 색은 DFragon 디자인 캔버스
// 카드 면, 상세 창 보드의 칸 색이고, 보드에 없는 서약 포인트는 초록(#3CC985)으로 정했다. 종류를 모르는 옵션은
// 카드 글자색, 빈 칸은 카드 테두리 색 1px 칸이다. 빨강과 보라는 같은 값의 토큰이 없고, 파랑, 초록, 주황은 같은
// 값의 토큰이 점수나 희귀도 같은 다른 뜻이라 묶지 않으려고 보드 값을 그대로 쓴다.
export const upgradeFill = stylex.create({
  damage: { backgroundColor: '#FF4848' },
  cooldown: { backgroundColor: '#4FA3FF' },
  oathPoint: { backgroundColor: '#3CC985' },
  speed: { backgroundColor: '#FFB400' },
  range: { backgroundColor: '#A066FF' },
  reduction: { backgroundColor: colors.cardFg },
  other: { backgroundColor: colors.cardFg },
  empty: { boxShadow: `inset 0 0 0 1px ${colors.cardBorder}` }
})
