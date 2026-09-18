import { investmentIds, investmentAriaLabelByKind } from '../../constants/equipment'
import * as stylex from '@stylexjs/stylex'
import type { EquipmentSlot } from '../../types/cards'
import { gradeStyles, styles } from './InvestmentTable.style'

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
      aria-label={investmentAriaLabelByKind[kind]}
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
