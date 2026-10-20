import * as stylex from '@stylexjs/stylex'
import type { SpriteIcon } from '../lib/equipment-icons'
import { styles } from './SpriteIconImage.style'

/**
 * sprite 한 칸을 감싼 상자에 꽉 차게 그린다. `label`이 있으면 그림 이름으로 보조 기술에 전하고, 없으면 장식으로
 * 숨긴다.
 */
export function SpriteIconImage({
  icon,
  label
}: {
  icon: SpriteIcon
  label?: string
}): React.JSX.Element {
  const { sprite, x, y, size, sheetWidth, sheetHeight } = icon
  const a11y = label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label }

  return (
    <span
      {...a11y}
      {...stylex.props(styles.icon, styles.at(sprite, x, y, size, sheetWidth, sheetHeight))}
    />
  )
}
