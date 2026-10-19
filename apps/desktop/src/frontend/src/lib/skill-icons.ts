import skillIcons from '@dfragon/icons/skills.json'
import spriteUrl from '@dfragon/icons/skills.webp?no-inline'

/** 스킬 아이콘 sprite의 칸 위치. 28 × 28 칸의 왼쪽 위 픽셀 좌표다. */
export type SkillIconCell = Readonly<{ x: number; y: number }>

const { iconSize, columns } = skillIcons.sprite
const cells: Readonly<Record<string, number>> = skillIcons.icons

/** `@dfragon/icons`의 스킬 아이콘 sprite URL. 작은 그림도 JS에 data URI로 넣지 않고 파일로 둔다. */
export const SKILL_ICON_SPRITE_URL: string = spriteUrl

/** 직업의 스킬 아이콘이 있는 sprite 칸. 아이콘을 뽑지 못한 스킬이면 undefined다. */
export function skillIconCell(jobId: string, skillId: string): SkillIconCell | undefined {
  const key = `${jobId}/${skillId}`
  if (!Object.hasOwn(cells, key)) {
    return undefined
  }
  const index = cells[key]
  const x = (index % columns) * iconSize
  const y = Math.floor(index / columns) * iconSize

  return { x, y }
}
