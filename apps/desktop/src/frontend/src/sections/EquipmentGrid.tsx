import { equipmentPositions } from '../constants/equipment'
import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'
import type { CardCharacter } from '../types/cards'
import { CardImage } from '../components/CardImage'
import { styles } from './EquipmentGrid.style'

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
      {equipmentPositions.map(([id, column, row]) => {
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
