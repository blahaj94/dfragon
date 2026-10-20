import { Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { upgradeFill } from '../constants/oath-upgrade.style'
import { rarityText } from '../constants/rarity.style'
import type { SummaryView, UpgradeCellView } from '../lib/card-faces'
import { CardImage } from './CardImage'
import { styles } from './DetailSummaryHead.style'

/**
 * 상세 창 장비 탭의 세트나 서약 머리(DFragon 디자인 캔버스 상세 창 보드). 그림, 이름과 포인트를 한 줄에 두고,
 * 서약은 그 아래 묵언의 진의 9칸을 둔다. 칸은 마우스나 키보드 포커스로 단계와 옵션 이름을 보인다. 세트는
 * 서약과 목록 시작을 맞추려고 같은 높이를 비운다.
 */
export function DetailSummaryHead({
  summary,
  upgrades
}: {
  summary: SummaryView
  upgrades?: UpgradeCellView[][]
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.head)}>
        <div {...stylex.props(styles.image)}>
          <CardImage src={summary.image} label={summary.imageLabel} />
        </div>
        <span
          title={summary.name}
          {...stylex.props(
            styles.name,
            summary.missing ? styles.nameMissing : rarityText[summary.tone]
          )}
        >
          {summary.name}
        </span>
        <span
          aria-label={`${summary.pointLabel} ${summary.point}`}
          {...stylex.props(styles.point, summary.missing && styles.pointMissing)}
        >
          {summary.point}
        </span>
      </div>
      {upgrades === undefined ? (
        <div aria-hidden="true" {...stylex.props(styles.upgradeSpace)} />
      ) : (
        <div role="list" aria-label="묵언의 진의" {...stylex.props(styles.upgrades)}>
          {upgrades.map((group) => (
            <div key={group[0].label} {...stylex.props(styles.upgradeGroup)}>
              {group.map((cell) => (
                <Tooltip.Root key={cell.label}>
                  <Tooltip.Trigger
                    delay={0}
                    closeDelay={0}
                    render={<span role="listitem" tabIndex={0} aria-label={cell.label} />}
                    {...stylex.props(styles.upgradeCell, upgradeFill[cell.kind])}
                  />
                  <Tooltip.Popup side="top" sideOffset={6} {...stylex.props(styles.upgradeTip)}>
                    {cell.label}
                  </Tooltip.Popup>
                </Tooltip.Root>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
