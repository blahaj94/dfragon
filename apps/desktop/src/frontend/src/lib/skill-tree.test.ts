import { describe, expect, it } from 'vitest'
import type { CharacterDetailSkill } from '../../../preload/common/types/character-detail'
import {
  type SkillLayout,
  type SkillLayoutSkill,
  findNeighborSkill,
  findSkillLayout,
  toSkillTreeRows
} from './skill-tree'

const WEAPON_MASTER = {
  jobId: '41f1cdc2ff58bb5fdc287be0db2a8df3',
  jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
}

function layoutSkill(skillId: string, patch: Partial<SkillLayoutSkill>): SkillLayoutSkill {
  return {
    skillId,
    row: 1,
    column: 0,
    name: skillId,
    type: 'active',
    requiredLevel: 1,
    awakening: false,
    ...patch
  }
}

function layout(skills: SkillLayoutSkill[]): SkillLayout {
  return { jobId: 'job', jobGrowId: 'grow', jobName: '직업', jobGrowName: '전직', skills }
}

function learned(patch: Partial<CharacterDetailSkill>): CharacterDetailSkill {
  return {
    name: '습득 이름',
    level: 1,
    description: null,
    coolTime: null,
    vpNames: [],
    vpName: null,
    ...patch
  }
}

describe('스킬트리 배치', () => {
  it('직업과 전직 ID로 배치를 찾고, 전직이 다르거나 없는 직업이면 null이다', () => {
    const weaponMaster = findSkillLayout(WEAPON_MASTER.jobId, WEAPON_MASTER.jobGrowId)

    expect(weaponMaster?.jobGrowName).toBe('眞 웨펀마스터')
    expect(findSkillLayout(WEAPON_MASTER.jobId, 'unknown-grow')).toBeNull()
    expect(findSkillLayout('unknown-job', WEAPON_MASTER.jobGrowId)).toBeNull()
  })

  it('웨펀마스터는 캔버스 상세 창 보드처럼 공통과 습득 레벨 17행, 58칸이다', () => {
    const weaponMaster = findSkillLayout(WEAPON_MASTER.jobId, WEAPON_MASTER.jobGrowId)!
    const rows = toSkillTreeRows(weaponMaster, {})

    expect(rows.map((row) => row.label)).toEqual([
      '공통',
      '1',
      '5',
      '10',
      '15',
      '20',
      '25',
      '30',
      '35',
      '40',
      '45',
      '50',
      '60',
      '70',
      '80',
      '95',
      '100'
    ])
    expect(rows.flatMap((row) => row.cells)).toHaveLength(58)
    expect(rows[0].cells.map((cell) => [cell.name, cell.column])).toEqual([
      ['기본기 숙련', 1],
      ['퀵 스탠딩', 2],
      ['백스텝', 3],
      ['백스텝 강화', 4],
      ['크리티컬 히트', 5],
      ['도약', 6],
      ['스킬 체인', 8]
    ])
    const awakenings = rows.flatMap((row) => row.cells.filter((cell) => cell.awakening))
    expect(awakenings.map((cell) => cell.name)).toEqual([
      '극 귀검술 : 폭풍식',
      '이기어검술',
      '천제극섬'
    ])
  })
})

describe('스킬트리 행과 칸', () => {
  it('행은 배치의 행 순서, 칸은 열 순서이고 빈 열을 채우거나 당기지 않는다', () => {
    const rows = toSkillTreeRows(
      layout([
        layoutSkill('late', { row: 3, column: 9, requiredLevel: 15 }),
        layoutSkill('right', { row: 1, column: 7 }),
        layoutSkill('left', { row: 1, column: 2 }),
        layoutSkill('common', { row: 0, column: 4, requiredLevel: 10 })
      ]),
      {}
    )

    expect(rows.map((row) => [row.row, row.label, row.ariaLabel])).toEqual([
      [0, '공통', '공통'],
      [1, '1', '1레벨'],
      [3, '15', '15레벨']
    ])
    expect(rows[1].cells.map((cell) => [cell.skillId, cell.column])).toEqual([
      ['left', 2],
      ['right', 7]
    ])
  })

  it('행 머리는 액티브 스킬에서 가장 많은 습득 레벨이고, 같으면 낮은 레벨, 액티브가 없으면 전체에서 고른다', () => {
    const rows = toSkillTreeRows(
      layout([
        layoutSkill('a1', { row: 1, column: 0, requiredLevel: 20 }),
        layoutSkill('a2', { row: 1, column: 1, requiredLevel: 25 }),
        layoutSkill('a3', { row: 1, column: 2, requiredLevel: 25 }),
        layoutSkill('p1', { row: 1, column: 3, requiredLevel: 15, type: 'passive' }),
        layoutSkill('p2', { row: 1, column: 4, requiredLevel: 15, type: 'passive' }),
        layoutSkill('p3', { row: 1, column: 5, requiredLevel: 15, type: 'passive' }),
        layoutSkill('b1', { row: 2, column: 0, requiredLevel: 75 }),
        layoutSkill('b2', { row: 2, column: 1, requiredLevel: 70 }),
        layoutSkill('c1', { row: 3, column: 0, requiredLevel: 48, type: 'passive' }),
        layoutSkill('c2', { row: 3, column: 1, requiredLevel: 50, type: 'passive' })
      ]),
      {}
    )

    expect(rows.map((row) => row.label)).toEqual(['25', '70', '48'])
  })

  it('익힌 스킬은 레벨, 설명, 쿨타임과 VP를 채우고 익히지 않은 스킬은 배치 이름과 레벨 0이다', () => {
    const [row] = toSkillTreeRows(
      layout([
        layoutSkill('learned', { name: '배치 이름', requiredLevel: 35, column: 3 }),
        layoutSkill('off', { name: '미습득', type: 'passive', requiredLevel: 40, column: 5 })
      ]),
      {
        learned: learned({
          name: '현재 이름',
          level: 43,
          description: '준비 동작을 행한 뒤\n무기를 뽑아 넓게 벤다.',
          coolTime: 15,
          vpNames: ['명가의 손놀림', '속전속결'],
          vpName: '속전속결'
        })
      }
    )

    expect(row.cells[0]).toMatchObject({
      name: '현재 이름',
      level: 43,
      kind: '액티브 · 35레벨 · 15초',
      description: '준비 동작을 행한 뒤\n무기를 뽑아 넓게 벤다.',
      vpNames: ['명가의 손놀림', '속전속결'],
      vpName: '속전속결',
      label: '현재 이름, 43레벨'
    })
    expect(row.cells[1]).toMatchObject({
      name: '미습득',
      level: 0,
      kind: '패시브 · 40레벨',
      description: null,
      vpNames: [],
      vpName: null,
      label: '미습득, 0레벨'
    })
  })

  it.each([
    [null, '액티브 · 1레벨'],
    [0, '액티브 · 1레벨'],
    [0.5, '액티브 · 1레벨 · 0.5초'],
    [135, '액티브 · 1레벨 · 135초']
  ])('쿨타임 %s는 종류 줄을 %s로 둔다', (coolTime, kind) => {
    const [row] = toSkillTreeRows(layout([layoutSkill('skill', {})]), {
      skill: learned({ coolTime })
    })

    expect(row.cells[0].kind).toBe(kind)
  })

  it('배치에 없는 캐릭터 스킬은 그리지 않고, 상속받은 이름의 skillId를 습득 값으로 읽지 않는다', () => {
    const [row] = toSkillTreeRows(layout([layoutSkill('toString', {})]), {
      unplaced: learned({ level: 9 })
    })

    expect(row.cells.map((cell) => [cell.skillId, cell.level])).toEqual([['toString', 0]])
  })

  it('설명 상자는 왼쪽 세 열은 왼쪽, 오른쪽 세 열은 오른쪽 맞춤이고 60레벨 이상 행은 칸 위에 뜬다', () => {
    const rows = toSkillTreeRows(
      layout([
        layoutSkill('c0', { row: 0, column: 0, requiredLevel: 70 }),
        layoutSkill('c2', { row: 1, column: 2, requiredLevel: 55 }),
        layoutSkill('c3', { row: 1, column: 3, requiredLevel: 55 }),
        layoutSkill('c7', { row: 2, column: 7, requiredLevel: 60 }),
        layoutSkill('c8', { row: 2, column: 8, requiredLevel: 60 })
      ]),
      {}
    )

    expect(rows.flatMap((row) => row.cells.map((cell) => [cell.skillId, cell.tip]))).toEqual([
      ['c0', { side: 'bottom', align: 'start' }],
      ['c2', { side: 'bottom', align: 'start' }],
      ['c3', { side: 'bottom', align: 'center' }],
      ['c7', { side: 'top', align: 'center' }],
      ['c8', { side: 'top', align: 'end' }]
    ])
  })
})

describe('방향키 이동', () => {
  const rows = toSkillTreeRows(
    layout([
      layoutSkill('a0', { row: 0, column: 0 }),
      layoutSkill('a5', { row: 0, column: 5 }),
      layoutSkill('b3', { row: 1, column: 3 }),
      layoutSkill('b7', { row: 1, column: 7 }),
      layoutSkill('c9', { row: 2, column: 9 })
    ]),
    {}
  )

  it.each([
    ['a0', 'ArrowRight', 'a5'],
    ['a5', 'ArrowLeft', 'a0'],
    ['a0', 'ArrowLeft', null],
    ['a5', 'ArrowRight', null],
    ['a5', 'ArrowDown', 'b3'],
    ['b7', 'ArrowUp', 'a5'],
    ['b3', 'ArrowDown', 'c9'],
    ['a0', 'ArrowUp', null],
    ['c9', 'ArrowDown', null],
    ['missing', 'ArrowDown', null]
  ] as const)('%s에서 %s는 %s로 간다', (from, key, to) => {
    expect(findNeighborSkill(rows, from, key)).toBe(to)
  })
})
