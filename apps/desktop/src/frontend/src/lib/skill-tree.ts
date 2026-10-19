import skillLayouts from '@dfragon/skill-layouts/layouts.json'
import type {
  CharacterDetailSkill,
  CharacterDetailSkills
} from '../../../preload/common/types/character-detail'

/** 직업 배치의 스킬 한 칸. 행, 열은 0부터이고 열은 11개다. 이름, 종류, 습득 레벨은 배치를 만든 때의 값이다. */
export type SkillLayoutSkill = Readonly<{
  skillId: string
  row: number
  column: number
  name: string
  type: string
  requiredLevel: number
  awakening: boolean
}>

/** 직업(jobId)과 전직(jobGrowId) 하나의 스킬트리 배치(`@dfragon/skill-layouts`). */
export type SkillLayout = Readonly<{
  jobId: string
  jobGrowId: string
  jobName: string
  jobGrowName: string
  skills: readonly SkillLayoutSkill[]
}>

/** 설명 상자를 칸의 어느 끝에 맞출지와 칸의 위, 아래 중 어디에 띄울지. */
export type SkillTipPlacement = Readonly<{
  side: 'top' | 'bottom'
  align: 'start' | 'center' | 'end'
}>

/** 스킬트리 칸 하나. `level`이 0이면 익히지 않은 스킬이다. */
export type SkillCellView = Readonly<{
  skillId: string
  column: number
  name: string
  level: number
  awakening: boolean
  /** `액티브 · 35레벨 · 15초`처럼 종류, 습득 레벨, 쿨타임. 쿨타임이 없으면 앞의 둘이다. */
  kind: string
  description: string | null
  /** 스킬의 VP 이름. 익히지 않았거나 상세를 받지 못한 스킬은 빈 목록이다. */
  vpNames: readonly string[]
  /** 캐릭터가 고른 VP. `vpNames` 중 하나이고 고르지 않았으면 null이다. */
  vpName: string | null
  /** 보조 기술 이름. `귀참, 60레벨`이다. */
  label: string
  tip: SkillTipPlacement
}>

/** 스킬트리 행 하나. `label`은 행 머리 글자(`공통`, `35`), `ariaLabel`은 `공통`, `35레벨`이다. */
export type SkillRowView = Readonly<{
  row: number
  label: string
  ariaLabel: string
  cells: readonly SkillCellView[]
}>

export type SkillMoveKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

const COMMON_ROW = 0
const COMMON_ROW_LABEL = '공통'
const LAST_COLUMN = 10
// 왼쪽 세 열과 오른쪽 세 열의 설명 상자는 가운데에 두면 스킬 탭 밖으로 나가므로 칸 끝에 맞춘다.
const START_ALIGN_LAST_COLUMN = 2
const END_ALIGN_FIRST_COLUMN = LAST_COLUMN - 2
// 60레벨 이상 행은 스킬 탭 아래쪽이라 설명 상자를 칸 위에 띄운다.
const TOP_TIP_FIRST_LEVEL = 60
const SKILL_TYPE_NAMES: Readonly<Record<string, string>> = { active: '액티브', passive: '패시브' }
const seconds = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
const layouts: readonly SkillLayout[] = skillLayouts.jobs

/** 직업과 전직의 스킬트리 배치. 배치 데이터에 없는 전직이면 null이다. */
export function findSkillLayout(jobId: string, jobGrowId: string): SkillLayout | null {
  const layout = layouts.find((entry) => entry.jobId === jobId && entry.jobGrowId === jobGrowId)
  if (layout === undefined) {
    return null
  }

  return layout
}

// 행 머리의 습득 레벨. 행에는 습득 레벨이 다른 스킬이 섞이므로 액티브 스킬에서 가장 많은 습득 레벨을 쓰고,
// 개수가 같으면 낮은 레벨이다. 액티브가 없는 행은 모든 스킬에서 같은 방식으로 고른다.
function rowLevel(skills: readonly SkillLayoutSkill[]): number {
  const actives = skills.filter((skill) => skill.type === 'active')
  const source = actives.length > 0 ? actives : skills
  const counts = new Map<number, number>()
  for (const skill of source) {
    counts.set(skill.requiredLevel, (counts.get(skill.requiredLevel) ?? 0) + 1)
  }
  const [[level]] = [...counts].sort(([a, countA], [b, countB]) => countB - countA || a - b)

  return level
}

function tipAlign(column: number): SkillTipPlacement['align'] {
  if (column <= START_ALIGN_LAST_COLUMN) {
    return 'start'
  }

  if (column >= END_ALIGN_FIRST_COLUMN) {
    return 'end'
  }

  return 'center'
}

function skillKind(skill: SkillLayoutSkill, coolTime: number | null): string {
  const type = SKILL_TYPE_NAMES[skill.type] ?? skill.type
  const kind = `${type} · ${skill.requiredLevel}레벨`
  if (coolTime === null || coolTime === 0) {
    return kind
  }

  return `${kind} · ${seconds.format(coolTime)}초`
}

function toCell(
  skill: SkillLayoutSkill,
  learned: CharacterDetailSkill | undefined,
  side: SkillTipPlacement['side']
): SkillCellView {
  const name = learned?.name ?? skill.name
  const level = learned?.level ?? 0
  const coolTime = learned?.coolTime ?? null
  const description = learned?.description ?? null
  const vpNames = learned?.vpNames ?? []
  const vpName = learned?.vpName ?? null
  const kind = skillKind(skill, coolTime)
  const label = `${name}, ${level}레벨`
  const tip = { side, align: tipAlign(skill.column) }

  return {
    skillId: skill.skillId,
    column: skill.column,
    name,
    level,
    awakening: skill.awakening,
    kind,
    description,
    vpNames,
    vpName,
    label,
    tip
  }
}

/**
 * 직업 배치와 캐릭터 스킬을 스킬트리 행으로 바꾼다. 행은 배치의 행 순서이고 칸은 정해진 열 그대로다. 캐릭터가
 * 익히지 않은 배치 스킬도 레벨 0으로 자리를 지키고, 배치에 없는 캐릭터 스킬은 그리지 않는다.
 */
export function toSkillTreeRows(
  layout: SkillLayout,
  skills: CharacterDetailSkills['learned']
): SkillRowView[] {
  const rows = new Map<number, SkillLayoutSkill[]>()
  for (const skill of layout.skills) {
    rows.set(skill.row, [...(rows.get(skill.row) ?? []), skill])
  }

  return [...rows]
    .sort(([a], [b]) => a - b)
    .map(([row, rowSkills]) => {
      const common = row === COMMON_ROW
      const level = rowLevel(rowSkills)
      const label = common ? COMMON_ROW_LABEL : String(level)
      const ariaLabel = common ? COMMON_ROW_LABEL : `${level}레벨`
      const side = !common && level >= TOP_TIP_FIRST_LEVEL ? 'top' : 'bottom'
      const cells = rowSkills
        .toSorted((a, b) => a.column - b.column)
        .map((skill) => {
          const learned = Object.hasOwn(skills, skill.skillId) ? skills[skill.skillId] : undefined

          return toCell(skill, learned, side)
        })

      return { row, label, ariaLabel, cells }
    })
}

function nearestCell(cells: readonly SkillCellView[], column: number): SkillCellView | undefined {
  const [nearest] = cells.toSorted(
    (a, b) => Math.abs(a.column - column) - Math.abs(b.column - column) || a.column - b.column
  )

  return nearest
}

/**
 * 방향키로 옮겨 갈 칸. 왼쪽, 오른쪽은 같은 행의 앞뒤 칸, 위, 아래는 이웃 행에서 열이 가장 가까운 칸이고 열
 * 거리가 같으면 왼쪽 칸이다. 그쪽에 칸이 없으면 null이다.
 */
export function findNeighborSkill(
  rows: readonly SkillRowView[],
  skillId: string,
  key: SkillMoveKey
): string | null {
  const rowIndex = rows.findIndex((row) => row.cells.some((cell) => cell.skillId === skillId))
  if (rowIndex < 0) {
    return null
  }
  const { cells } = rows[rowIndex]
  const cellIndex = cells.findIndex((cell) => cell.skillId === skillId)
  const { column } = cells[cellIndex]
  let target: SkillCellView | undefined
  if (key === 'ArrowLeft') {
    target = cells[cellIndex - 1]
  } else if (key === 'ArrowRight') {
    target = cells[cellIndex + 1]
  } else {
    const nextRow = rows[key === 'ArrowUp' ? rowIndex - 1 : rowIndex + 1]
    target = nextRow === undefined ? undefined : nearestCell(nextRow.cells, column)
  }

  if (target === undefined) {
    return null
  }

  return target.skillId
}
