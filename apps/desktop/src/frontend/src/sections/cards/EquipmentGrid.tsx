import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'
import type { CardCharacter } from '../../components/cards/types'
import { CardImage } from '../../components/cards/CardImage'
import { styles } from './EquipmentGrid.style'

// Explicit visual positions; equipment arrays may arrive in any order.
const positions = [
  ['SHOULDER', 1, 1],
  ['JACKET', 2, 1],
  ['PANTS', 1, 2],
  ['WAIST', 2, 2],
  ['SHOES', 1, 3],
  ['AURA', 1, 4],
  ['CREATURE', 2, 4],
  ['WEAPON', 3, 1],
  ['TITLE', 4, 1],
  ['WRIST', 3, 2],
  ['AMULET', 4, 2],
  ['SUPPORT', 3, 3],
  ['RING', 4, 3],
  ['EARRING', 3, 4],
  ['MAGIC_STON', 4, 4]
] as const

function isExtraEquipmentSlot({ id }: { id: string }): boolean {
  return ['AURA', 'CREATURE', 'TITLE'].includes(id)
}

function shouldHideSlot({
  id,
  oath,
  large
}: {
  id: string
  oath: boolean
  large: boolean
}): boolean {
  return oath && !large && isExtraEquipmentSlot({ id })
}

export function EquipmentGrid({
  character,
  oath = false,
  large = false
}: {
  character: CardCharacter
  oath?: boolean
  large?: boolean
}): React.JSX.Element {
  const slots = oath ? character.oath : character.equipment
  return (
    <div {...stylex.props(styles.equipment, large && styles.largeEquipment)}>
      {positions.map(([id, column, row]) => {
        if (shouldHideSlot({ id, large, oath })) {
          return null
        }
        const source = oath && large && isExtraEquipmentSlot({ id }) ? character.equipment : slots
        const slot = source.find((item) => item.id === id)

        return (
          <div
            key={id}
            title={slot?.label ?? id}
            {...stylex.props(
              styles.slot,
              styles.rarity(slot?.rarityColor ?? colors.border),
              styles.position(large && column > 2 ? column + 1 : column, row)
            )}
          >
            <CardImage src={slot?.image} label={slot?.label ?? id} />
          </div>
        )
      })}
      {large && (
        <div {...stylex.props(styles.portrait)}>
          <CardImage src={character.image} label="캐릭터" portrait />
        </div>
      )}
    </div>
  )
}
