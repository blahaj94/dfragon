import { describe, expect, it } from 'vitest'
import type { CharacterCandidate } from '../../preload/common/types/character'
import {
  NO_RAID_OBSERVED_VALUES,
  planRaidComparison,
  selectRaidCandidate,
  toRaidObservedValues,
  type RaidObservedValues
} from './raid-candidate'

// 합성 후보와 직업명만 쓰며 표본이나 플레이어 식별자는 넣지 않는다.
function candidate(
  id: string,
  fame: number | null,
  jobGrowName: string | null = '眞 크루세이더'
): CharacterCandidate {
  return {
    characterId: id,
    characterName: '공대원',
    serverId: 'cain',
    serverName: '카인',
    fame,
    imageUrl: `https://img-api.neople.co.kr/df/servers/cain/characters/${id}?zoom=1`,
    adventureName: null,
    jobName: null,
    jobGrowName
  }
}

function observed(overrides: Partial<RaidObservedValues> = {}): RaidObservedValues {
  return { ...NO_RAID_OBSERVED_VALUES, ...overrides }
}

function fameRow(value: number): RaidObservedValues {
  return observed({ valueColumn: 'fame', value: { min: value, max: value } })
}

function scoreRow(min: number, max = min): RaidObservedValues {
  return observed({ valueColumn: 'equipment-score', value: { min, max } })
}

describe('공대 행 관측값 변환', () => {
  it('수치 표기를 값 범위로 바꾸고 해석할 수 없는 표기와 빠진 관측은 값 없음으로 둔다', () => {
    expect(
      toRaidObservedValues({ jobText: '眞 크루', valueColumn: 'fame', valueText: '1000.4K' })
    ).toEqual({
      jobText: '眞 크루',
      valueColumn: 'fame',
      value: { min: 1_000_400, max: 1_000_499 }
    })
    expect(
      toRaidObservedValues({ jobText: null, valueColumn: 'fame', valueText: '1.2' }).value
    ).toBeNull()
    expect(toRaidObservedValues(undefined)).toEqual(NO_RAID_OBSERVED_VALUES)
  })
})

describe('직업명 그룹과 비교 계획', () => {
  it('직업명이 맞는 후보가 한 명이면 수치와 무관하게 그 후보를 직업명으로 확정한다', () => {
    const crusader = candidate('crusader', 1000)
    const slayer = candidate('slayer', 90000, '眞 데몬슬레이어')
    const plan = planRaidComparison({
      observed: { ...fameRow(90000), jobText: '眞크루세이더' },
      candidates: [slayer, crusader]
    })

    expect(plan).toEqual({ kind: 'job', candidate: crusader })
    expect(selectRaidCandidate(plan!)).toEqual({ candidate: crusader, selectionMethod: 'job' })
  })

  it('직업명이 맞는 후보가 둘 이상이면 그 후보만 명성 순으로 비교한다', () => {
    const low = candidate('low', 1000)
    const other = candidate('other', 99000, '眞 데몬슬레이어')
    const high = candidate('high', 50000)

    expect(
      planRaidComparison({
        observed: { ...fameRow(1000), jobText: '眞 크루세이더' },
        candidates: [low, other, high]
      })
    ).toEqual({ kind: 'fame', group: [high, low], value: { min: 1000, max: 1000 } })
  })

  it.each([
    ['직업명이 맞는 후보가 없을 때', '眞 소드마스터', '眞 크루세이더'],
    ['직업명을 읽지 못했을 때', null, '眞 크루세이더'],
    ['이전 API가 직업명을 보내지 않았을 때', '眞 크루세이더', null]
  ])('%s 동명 후보 전체를 그룹으로 쓴다', (_case, jobText, jobGrowName) => {
    const low = candidate('low', 1000, jobGrowName)
    const high = candidate('high', 50000, jobGrowName)

    expect(
      planRaidComparison({ observed: { ...fameRow(1000), jobText }, candidates: [low, high] })
    ).toEqual({ kind: 'fame', group: [high, low], value: { min: 1000, max: 1000 } })
  })

  it.each([
    ['장비 점수 열일 때', scoreRow(100_000)],
    ['수치 열 종류를 모를 때', observed({ valueColumn: 'unknown', value: { min: 1, max: 1 } })],
    ['수치를 읽지 못했을 때', observed({ valueColumn: 'fame', value: null })]
  ])('%s 그룹 안 최고 명성 후보를 고르고 그룹 후보를 함께 돌려준다', (_case, row) => {
    const low = candidate('low', 1000)
    const high = candidate('high', 90000)
    const plan = planRaidComparison({ observed: row, candidates: [low, high] })

    expect(selectRaidCandidate(plan!)).toEqual({
      candidate: high,
      selectionMethod: 'highest-fame',
      choices: [high, low]
    })
  })

  it('비교 근거 없이 후보가 한 명이면 고를 후보 없이 최고 명성으로 고른다', () => {
    const only = candidate('only', 1000)
    const plan = planRaidComparison({ observed: NO_RAID_OBSERVED_VALUES, candidates: [only] })

    expect(selectRaidCandidate(plan!)).toEqual({ candidate: only, selectionMethod: 'highest-fame' })
  })

  it('후보가 없으면 계획하지 않고 입력 후보 배열을 바꾸지 않는다', () => {
    expect(planRaidComparison({ observed: fameRow(1), candidates: [] })).toBeNull()
    const candidates = [candidate('a', 1), candidate('b', 2)]
    const before = [...candidates]
    planRaidComparison({ observed: fameRow(1), candidates })

    expect(candidates).toEqual(before)
  })
})

describe('명성 비교', () => {
  function selectByFame(screen: number, fames: readonly number[]) {
    const group = fames.map((fame) => candidate(`fame-${fame}`, fame))
    const plan = planRaidComparison({ observed: fameRow(screen), candidates: group })

    return selectRaidCandidate(plan!)
  }

  it.each([
    ['1위 오차 2,000, 간격 2,000이면 확정한다', 50_000, [52_000, 54_000], 'fame-52000', false],
    ['1위 오차가 2,001이면 추정한다', 50_000, [52_001, 56_002], 'fame-52001', true],
    ['2위와의 간격이 1,999면 추정한다', 50_000, [50_000, 51_999], 'fame-50000', true],
    [
      '표기 범위 안의 1위가 2,000 떨어진 2위보다 앞서면 확정한다',
      50_000,
      [50_000, 48_000],
      'fame-50000',
      false
    ]
  ])('%s', (_case, screen, fames, expected, ambiguous) => {
    const selection = selectByFame(screen, fames)

    expect(selection.candidate.characterId).toBe(expected)
    expect(selection.selectionMethod).toBe('fame')
    expect(selection.choices !== undefined).toBe(ambiguous)
  })

  it('K 표기는 보일 수 있는 범위 안을 오차 0으로 본다', () => {
    const inRange = candidate('in-range', 1_000_499)
    const outside = candidate('outside', 1_002_500)
    const value = { min: 1_000_400, max: 1_000_499 }
    const plan = planRaidComparison({
      observed: observed({ valueColumn: 'fame', value }),
      candidates: [inRange, outside]
    })

    expect(selectRaidCandidate(plan!)).toEqual({ candidate: inRange, selectionMethod: 'fame' })
  })

  it('비교한 후보 중 명성이 없는 후보가 있으면 가장 가까운 후보를 추정으로 고른다', () => {
    const close = candidate('close', 50_000)
    const unknown = candidate('unknown', null)
    const plan = planRaidComparison({ observed: fameRow(50_000), candidates: [unknown, close] })

    expect(selectRaidCandidate(plan!)).toEqual({
      candidate: close,
      selectionMethod: 'fame',
      choices: [close, unknown]
    })
  })

  it('그룹에 명성이 있는 후보가 없으면 최고 명성 선택으로 돌아간다', () => {
    const first = candidate('first', null)
    const second = candidate('second', null)
    const plan = planRaidComparison({ observed: fameRow(50_000), candidates: [first, second] })

    expect(selectRaidCandidate(plan!)).toMatchObject({
      candidate: first,
      selectionMethod: 'highest-fame'
    })
  })

  it('그룹이 한 명이면 고를 후보가 없어 오차가 2,000을 넘어도 추정으로 표시하지 않는다', () => {
    const only = candidate('only', 60_000)
    const plan = planRaidComparison({ observed: fameRow(50_000), candidates: [only] })

    expect(selectRaidCandidate(plan!)).toEqual({ candidate: only, selectionMethod: 'fame' })
  })
})
