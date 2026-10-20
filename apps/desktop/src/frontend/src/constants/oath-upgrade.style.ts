import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

// 묵언의 진의 칸이 옵션 종류(lib/card-faces의 UpgradeCellView kind)로 고르는 면. 다섯 옵션 색은 묵언의 진의
// 전용 `oathUpgrade*` 토큰이고, 종류를 모르는 옵션과 피해 감소는 카드 글자색, 빈 칸은 카드 테두리 색 1px 칸이다.
export const upgradeFill = stylex.create({
  damage: { backgroundColor: colors.oathUpgradeDamage },
  cooldown: { backgroundColor: colors.oathUpgradeCooldown },
  oathPoint: { backgroundColor: colors.oathUpgradeOathPoint },
  speed: { backgroundColor: colors.oathUpgradeSpeed },
  range: { backgroundColor: colors.oathUpgradeRange },
  reduction: { backgroundColor: colors.cardFg },
  other: { backgroundColor: colors.cardFg },
  empty: { boxShadow: `inset 0 0 0 1px ${colors.cardBorder}` }
})
