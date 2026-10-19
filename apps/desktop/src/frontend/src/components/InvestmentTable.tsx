import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { rarityText } from '../constants/rarity.style'
import { ItemIcon } from './ItemIcon'
import type { EnchantView, InvestmentRowView } from '../lib/card-faces'
import { gradeStyles, reinforceStyles, styles } from './InvestmentTable.style'

const ENCHANT_DOTS = [1, 2, 3] as const

/**
 * 12부위의 아이템, 강화나 증폭 수치, 마법부여 등급 표(DFragon 디자인 캔버스 카드 면 보드의 기타 면). 강화와 증폭은
 * 색과 함께 보조 기술에 종류를 전하고, 마법부여는 3점 표시에 등급 이름을 붙인다.
 */
export function InvestmentTable({ rows }: { rows: InvestmentRowView[] }): React.JSX.Element {
  return (
    <table aria-label="강화와 마법부여" {...stylex.props(styles.table)}>
      <thead>
        <tr>
          <th scope="col" {...stylex.props(styles.head)}>
            장비
          </th>
          <th scope="col" {...stylex.props(styles.head, styles.reinforceColumn, styles.legendCell)}>
            <span {...stylex.props(styles.legend)}>
              <span {...stylex.props(styles.legendItem)}>
                <i aria-hidden="true" {...stylex.props(styles.swatch, styles.swatchEnhance)} />
                강화
              </span>
              <span {...stylex.props(styles.legendItem)}>
                <i aria-hidden="true" {...stylex.props(styles.swatch, styles.swatchAmplify)} />
                증폭
              </span>
            </span>
          </th>
          <th scope="col" {...stylex.props(styles.head, styles.enchantColumn)}>
            마법부여
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.slotId} {...stylex.props(styles.row)}>
            <th
              scope="row"
              title={row.itemName}
              {...stylex.props(
                styles.item,
                row.itemTone === 'missing' ? styles.itemMissing : rarityText[row.itemTone]
              )}
            >
              <span {...stylex.props(styles.itemInner)}>
                <ItemIcon src={row.imageUrl} tone={row.itemTone} />
                <span aria-hidden="true" {...stylex.props(styles.itemName)}>
                  {row.itemName}
                </span>
              </span>
              <span {...stylex.props(shapes.srOnly)}>{row.itemLabel}</span>
            </th>
            <td
              {...stylex.props(
                styles.reinforce,
                styles.reinforceColumn,
                reinforceStyles[row.reinforce.tone]
              )}
            >
              <span aria-hidden="true">{row.reinforce.text}</span>
              <span {...stylex.props(shapes.srOnly)}>{row.reinforce.label}</span>
            </td>
            <td {...stylex.props(styles.enchant, styles.enchantColumn)}>
              <EnchantCell enchant={row.enchant} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// 마법부여 등급 3점. 종결 셋, 준종결 둘, 기타 하나를 등급 색으로 칠하고 미평가와 마법부여 없음은 `-`다.
function EnchantCell({ enchant }: { enchant: EnchantView }): React.JSX.Element {
  if (enchant.grade == null) {
    return (
      <>
        <span aria-hidden="true" {...stylex.props(styles.enchantMissing)}>
          {enchant.text}
        </span>
        <span {...stylex.props(shapes.srOnly)}>{enchant.label}</span>
      </>
    )
  }

  return (
    <span role="img" aria-label={enchant.label} {...stylex.props(styles.dots)}>
      {ENCHANT_DOTS.map((dot) => (
        <span
          key={dot}
          {...stylex.props(
            styles.dot,
            dot <= enchant.filled ? gradeStyles[enchant.grade] : styles.dotEmpty
          )}
        />
      ))}
    </span>
  )
}
