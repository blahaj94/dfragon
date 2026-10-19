import { expect, it } from 'vitest'
import { SKILL_ICON_SPRITE_URL, skillIconCell } from './skill-icons'

const WEAPON_MASTER_JOB_ID = '41f1cdc2ff58bb5fdc287be0db2a8df3'

// 기대값은 `@dfragon/icons/skills.json`에서 직접 확인한 칸 번호(발도 444, 귀참 1700)와 한 줄 48칸, 칸 28px로 셈한
// sprite 위치다. 첫 줄이 아니고 x와 y가 다른 칸이라 가로, 세로를 바꾸면 실패한다.
it.each([
  ['발도', 'cfacda0647b9a0f595df2c2aad30c18d', { x: 336, y: 252 }],
  ['귀참', 'eb71e1d82d92c7e1d40500a0dcd77aa6', { x: 560, y: 980 }]
])('%s 아이콘은 sprite의 정해진 칸이다', (_, skillId, cell) => {
  expect(skillIconCell(WEAPON_MASTER_JOB_ID, skillId)).toEqual(cell)
})

it('색인에 없는 스킬이나 다른 직업의 같은 skillId는 칸이 없다', () => {
  expect(skillIconCell(WEAPON_MASTER_JOB_ID, 'unknown-skill')).toBeUndefined()
  expect(skillIconCell('unknown-job', 'cfacda0647b9a0f595df2c2aad30c18d')).toBeUndefined()
})

it('sprite는 data URI가 아닌 파일 URL이다', () => {
  expect(SKILL_ICON_SPRITE_URL).toMatch(/skills\.webp/)
  expect(SKILL_ICON_SPRITE_URL.startsWith('data:')).toBe(false)
})
