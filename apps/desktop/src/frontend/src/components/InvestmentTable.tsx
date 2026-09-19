import { Typo } from '@ldb/ui'
import { investmentIds, investmentAriaLabelByKind } from '../constants/equipment'
import * as stylex from '@stylexjs/stylex'
import type { EquipmentSlot } from '../types/cards'
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
  const Cell = large ? Typo.txtS : Typo.caption
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
              <Cell as="th" scope="row" {...stylex.props(styles.cell, large && styles.largeCell)}>
                {item?.label ?? id}
              </Cell>
              {kind !== 'enchantment' && (
                <Cell
                  as="td"
                  {...stylex.props(
                    styles.cell,
                    large && styles.largeCell,
                    styles.value,
                    styles.enhancement
                  )}
                >
                  {item?.enhancement ?? '-'}
                </Cell>
              )}
              {kind !== 'enhancement' && (
                <Cell
                  as="td"
                  {...stylex.props(
                    styles.cell,
                    large && styles.largeCell,
                    styles.value,
                    gradeStyles[item?.enchantment ?? '미평가']
                  )}
                >
                  {item?.enchantment ?? '-'}
                </Cell>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
