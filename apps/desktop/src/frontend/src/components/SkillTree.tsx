import { Tooltip, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef } from 'react'
import { skillIconUrl } from '../lib/skill-icons'
import {
  type SkillCellView,
  type SkillMoveKey,
  type SkillRowView,
  findNeighborSkill
} from '../lib/skill-tree'
import { styles } from './SkillTree.style'

const MOVE_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

function isMoveKey(key: string): key is SkillMoveKey {
  return MOVE_KEYS.has(key)
}

/**
 * 상세 창 스킬 탭의 11열 스킬트리(DFragon 디자인 캔버스 상세 창 보드). 행마다 머리에 `공통`이나 습득 레벨을
 * 두고 스킬은 정해진 열에 아이콘과 레벨로 그린다. 익히지 않은 스킬은 흐리게, 각성기는 크림 테두리로 그린다.
 * 칸에 마우스를 올리거나 키보드로 포커스하면 설명 상자를 열고, 방향키로 이웃 칸에 포커스를 옮긴다. 설명
 * 상자의 VP 칩은 스킬의 VP를 모두 두고 캐릭터가 고른 VP를 크림 글자로 구분한다.
 */
export function SkillTree({
  jobId,
  rows
}: {
  jobId: string
  rows: readonly SkillRowView[]
}): React.JSX.Element {
  const treeRef = useRef<HTMLDivElement>(null)
  const moveFocus = (event: React.KeyboardEvent<HTMLLIElement>, skillId: string): void => {
    if (!isMoveKey(event.key)) {
      return
    }
    event.preventDefault()
    const target = findNeighborSkill(rows, skillId, event.key)
    if (target === null) {
      return
    }
    treeRef.current?.querySelector<HTMLElement>(`[data-skill-id="${CSS.escape(target)}"]`)?.focus()
  }

  return (
    <div ref={treeRef} role="group" aria-label="스킬트리" {...stylex.props(styles.tree)}>
      {rows.map((row) => (
        <ul key={row.row} aria-label={row.ariaLabel} {...stylex.props(styles.row)}>
          <li aria-hidden="true" {...stylex.props(styles.rowLabel)}>
            {row.label}
          </li>
          {row.cells.map((cell) => (
            <SkillCell
              key={cell.skillId}
              cell={cell}
              iconUrl={skillIconUrl(jobId, cell.skillId)}
              onKeyDown={(event) => moveFocus(event, cell.skillId)}
            />
          ))}
        </ul>
      ))}
    </div>
  )
}

function SkillIcon({ src, off }: { src: string | undefined; off: boolean }): React.JSX.Element {
  if (src === undefined) {
    return <span aria-hidden="true" {...stylex.props(styles.icon, styles.iconMissing)} />
  }

  return (
    <img
      src={src}
      alt=""
      width={28}
      height={28}
      draggable={false}
      {...stylex.props(styles.icon, off && styles.iconOff)}
    />
  )
}

function SkillCell({
  cell,
  iconUrl,
  onKeyDown
}: {
  cell: SkillCellView
  iconUrl: string | undefined
  onKeyDown: (event: React.KeyboardEvent<HTMLLIElement>) => void
}): React.JSX.Element {
  const off = cell.level === 0

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={0}
        closeDelay={0}
        render={
          <li
            tabIndex={0}
            aria-label={cell.label}
            data-skill-id={cell.skillId}
            onKeyDown={onKeyDown}
          />
        }
        {...stylex.props(
          styles.cell,
          styles.cellAt(cell.column),
          cell.awakening && styles.awakening
        )}
      >
        <SkillIcon src={iconUrl} off={off} />
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.level,
            cell.awakening && styles.levelAwakening,
            off && styles.levelOff
          )}
        >
          {cell.level}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Popup
        role="tooltip"
        side={cell.tip.side}
        align={cell.tip.align}
        sideOffset={6}
        {...stylex.props(styles.tip, shapes.cutTopRight)}
      >
        <span {...stylex.props(styles.tipHead)}>
          <SkillIcon src={iconUrl} off={off} />
          <span {...stylex.props(styles.tipName)}>{cell.name}</span>
          <span aria-hidden="true" {...stylex.props(styles.tipLevel)}>
            {cell.level}
          </span>
        </span>
        <span {...stylex.props(styles.tipKind)}>{cell.kind}</span>
        {cell.description !== null && (
          <span {...stylex.props(styles.tipText)}>{cell.description}</span>
        )}
        {cell.vpNames.length > 0 && (
          <span {...stylex.props(styles.vpChips)}>
            {cell.vpNames.map((vpName) => (
              <span
                key={vpName}
                {...stylex.props(styles.vpChip, vpName === cell.vpName && styles.vpChipSelected)}
              >
                {vpName}
                {vpName === cell.vpName && <span {...stylex.props(shapes.srOnly)}> (고른 VP)</span>}
              </span>
            ))}
          </span>
        )}
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
