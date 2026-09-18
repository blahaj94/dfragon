import * as stylex from '@stylexjs/stylex'
import type { EquipmentSlot } from './types'
import { gradeStyles, styles } from './InvestmentTable.style'

const investmentIds = [
  'WEAPON',
  'JACKET',
  'SHOULDER',
  'PANTS',
  'WAIST',
  'SHOES',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
]

const ariaLabelByKind = {
  enhancement: '강화 수치',
  enchantment: '마법부여 등급',
  both: '투자 현황'
} as const

export function InvestmentTable({
  equipment,
  kind = 'both',
  large = false
}: {
  equipment: EquipmentSlot[]
  kind?: 'both' | 'enhancement' | 'enchantment'
  large?: boolean
}): React.JSX.Element {
  return (
    <table
      aria-label={ariaLabelByKind[kind]}
      {...stylex.props(styles.table, large && styles.largeTable)}
    >
      <tbody>
        {investmentIds.map((id) => {
          const item = equipment.find((slot) => slot.id === id)
          return (
            <tr key={id} {...stylex.props(styles.row)}>
              <th scope="row" {...stylex.props(styles.cell)}>
                {item?.label ?? id}
              </th>
              {kind !== 'enchantment' && (
                <td {...stylex.props(styles.cell, styles.value, styles.enhancement)}>
                  {item?.enhancement ?? '-'}
                </td>
              )}
              {kind !== 'enhancement' && (
                <td
                  {...stylex.props(
                    styles.cell,
                    styles.value,
                    gradeStyles[item?.enchantment ?? '미평가']
                  )}
                >
                  {item?.enchantment ?? '-'}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
