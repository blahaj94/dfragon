import { Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { rarityFill, rarityText } from '../constants/rarity.style'
import type { SummaryView, UpgradeCellView } from '../lib/card-faces'
import { CardImage } from './CardImage'
import { styles } from './EquipmentSummary.style'

/**
 * 장비 면의 세트나 서약 섹션(DFragon 디자인 캔버스 카드 면 보드). 그림과 이름, 포인트, 부위 희귀도 격자,
 * 희귀도 개수를 보이고, 서약은 이름 아래 묵언의 진의 9칸을 더한다. 격자는 개수 칩이 글자로 전하므로 보조
 * 기술에서 뺀다.
 */
export function EquipmentSummary({
  label,
  summary,
  upgrades
}: {
  label: string
  summary: SummaryView
  upgrades?: UpgradeCellView[][]
}): React.JSX.Element {
  return (
    <section aria-label={label} {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.head)}>
        <div {...stylex.props(styles.image)}>
          <CardImage src={summary.image} label={summary.imageLabel} />
        </div>
        <div {...stylex.props(styles.title)}>
          <span
            title={summary.name}
            {...stylex.props(
              styles.name,
              summary.missing ? styles.nameMissing : rarityText[summary.tone]
            )}
          >
            {summary.name}
          </span>
          {upgrades !== undefined && (
            <div role="list" aria-label="묵언의 진의" {...stylex.props(styles.upgrades)}>
              {upgrades.map((group) => (
                <div
                  key={group[0].label}
                  {...stylex.props(styles.upgradeGroup, styles.upgradeGroupWidth(group.length))}
                >
                  {group.map((cell) => (
                    <span
                      key={cell.label}
                      role="listitem"
                      aria-label={cell.label}
                      title={cell.label}
                      {...stylex.props(
                        styles.upgradeCell,
                        cell.filled ? styles.upgradeFilled : styles.upgradeEmpty
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div {...stylex.props(styles.point)}>
        <Typo.caption {...stylex.props(styles.pointLabel)}>{summary.pointLabel}</Typo.caption>
        <span {...stylex.props(styles.pointValue, summary.missing && styles.pointMissing)}>
          {summary.point}
        </span>
      </div>
      <div {...stylex.props(styles.rarity)}>
        <div aria-hidden="true" {...stylex.props(styles.grid)}>
          {summary.groups.map((group) => (
            <div
              key={group.id}
              {...stylex.props(
                styles.group,
                group.main ? styles.groupMain : styles.groupWidth(group.cells.length)
              )}
            >
              {group.cells.map((cell) => (
                <span
                  key={cell.id}
                  {...stylex.props(
                    styles.cell,
                    group.main && styles.cellMain,
                    cell.tone === 'empty' ? styles.cellEmpty : rarityFill[cell.tone]
                  )}
                />
              ))}
            </div>
          ))}
        </div>
        {summary.counts.length > 0 && (
          <div {...stylex.props(styles.counts)}>
            {summary.counts.map((count) => (
              <span key={count.label} {...stylex.props(styles.count)}>
                <Typo.caption {...stylex.props(styles.countLabel)}>{count.label}</Typo.caption>{' '}
                <span {...stylex.props(styles.countValue, rarityText[count.tone])}>
                  {count.count}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
