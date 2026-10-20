import { Tooltip, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { rarityText } from '../constants/rarity.style'
import type { DetailItemGroupView, DetailItemRowView } from '../lib/character-detail'
import { ItemIcon } from './ItemIcon'
import { reinforceStyles, rowTones, styles } from './DetailItemList.style'

/**
 * 상세 창 장비 탭의 장비나 서약 목록(DFragon 디자인 캔버스 상세 창 보드). 줄마다 아이콘 칸, 이름과 마법부여
 * 옵션, 강화나 증폭을 두고 마우스를 올리거나 키보드로 포커스하면 설명 상자를 연다. 설명 상자는 이름과 부위
 * 뒤에 아이템 설명, 마법부여, 버프 스킬, 플레이버 문구 순이고 문구가 없는 칸은 두지 않는다. 묶음 사이는 띄우고, 장착
 * 정보가 없는 줄은 포커스와 설명 상자 없이 자리만 지킨다. `align`은 설명 상자를 줄의 어느 끝에 맞출지다.
 */
export function DetailItemList({
  label,
  groups,
  align
}: {
  label: string
  groups: DetailItemGroupView[]
  align: 'start' | 'end'
}): React.JSX.Element {
  return (
    <ul aria-label={label} {...stylex.props(styles.list)}>
      {groups.flatMap((group, groupIndex) =>
        group.rows.map((row, rowIndex) => (
          <DetailItemRow
            key={row.id}
            row={row}
            align={align}
            spaced={groupIndex > 0 && rowIndex === 0}
          />
        ))
      )}
    </ul>
  )
}

function DetailItemRow({
  row,
  align,
  spaced
}: {
  row: DetailItemRowView
  align: 'start' | 'end'
  spaced: boolean
}): React.JSX.Element {
  const { tone, text } = row
  const content = (
    <>
      <ItemIcon src={row.image} tone={tone} large />
      <span {...stylex.props(styles.text)}>
        <span
          aria-hidden="true"
          {...stylex.props(styles.name, tone === 'missing' ? styles.nameMissing : rarityText[tone])}
        >
          {row.name}
        </span>
        <span {...stylex.props(shapes.srOnly)}>{row.label}</span>
        {row.enchant !== null && <span {...stylex.props(styles.enchant)}>{row.enchant}</span>}
      </span>
      {row.reinforce !== null && (
        <span {...stylex.props(styles.reinforce, reinforceStyles[row.reinforce.tone])}>
          <span aria-hidden="true">{row.reinforce.text}</span>
          <span {...stylex.props(shapes.srOnly)}>{row.reinforce.label}</span>
        </span>
      )}
    </>
  )
  const rowStyles = [styles.row, row.lead && styles.lead, spaced && styles.spaced]
  if (tone === 'missing') {
    return <li {...stylex.props(rowStyles, styles.rowMissing)}>{content}</li>
  }

  return (
    <Tooltip.Root
      // 설명 상자가 아래 줄을 덮어도 마우스가 그쪽에 닿도록 상자 위에서는 열린 채로 두지 않는다.
      disableHoverablePopup
    >
      <Tooltip.Trigger
        delay={0}
        closeDelay={0}
        render={<li tabIndex={0} />}
        {...stylex.props(rowStyles, rowTones[tone], styles.interactive)}
      >
        {content}
      </Tooltip.Trigger>
      <Tooltip.Popup
        side="bottom"
        align={align}
        sideOffset={4}
        {...stylex.props(styles.tip, shapes.cutTopRight, rowTones[tone])}
      >
        <span {...stylex.props(styles.tipHead)}>
          <ItemIcon src={row.image} tone={tone} large />
          <span {...stylex.props(styles.tipName, rarityText[tone])}>{row.name}</span>
          {row.reinforce !== null && (
            <span
              aria-hidden="true"
              {...stylex.props(styles.tipReinforce, reinforceStyles[row.reinforce.tone])}
            >
              {row.reinforce.text}
            </span>
          )}
        </span>
        <span {...stylex.props(styles.tipKind)}>{row.kind}</span>
        {(text.heading !== null || text.explain !== null) && (
          <span {...stylex.props(styles.tipText, styles.tipExplain)}>
            {text.heading !== null && (
              <span {...stylex.props(styles.tipHeading)}>{text.heading}</span>
            )}
            {text.explain}
          </span>
        )}
        {row.enchant !== null && (
          <span {...stylex.props(styles.tipField)}>
            <span {...stylex.props(styles.tipFieldLabel)}>마법부여</span>
            <span {...stylex.props(styles.tipFieldValue)}>{row.enchant}</span>
          </span>
        )}
        {text.buff !== null && <span {...stylex.props(styles.tipText)}>{text.buff}</span>}
        {text.flavor !== null && (
          <span {...stylex.props(styles.tipText, styles.tipFlavor)}>{text.flavor}</span>
        )}
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
