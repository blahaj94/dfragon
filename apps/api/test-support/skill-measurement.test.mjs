import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { calculateSnapshotMeasurement, compareSkillDamage } from './skill-measurement.mjs'

function observations() {
  return {
    context: {
      id: 'synthetic-session',
      target: { kind: 'sandbag', level: 110 },
      conditions: ['동일한 합성 장비', '전체 명중', '도핑 없음'],
      status: [{ name: '힘', value: 2000 }]
    },
    levelOverrides: [
      { skillId: 'reference', level: 2, source: '합성 관측' },
      { skillId: 'comparison', level: 3, source: '합성 관측' },
      { skillId: 'passive', level: 8, source: '합성 장비 스킬 레벨' }
    ],
    reference: {
      skillId: 'reference',
      level: 2,
      contextId: 'synthetic-session',
      targetLevel: 110,
      damage: 100,
      multiplier: { value: 1, source: '개별 보정 없음' }
    },
    comparison: {
      skillId: 'comparison',
      level: 3,
      contextId: 'synthetic-session',
      targetLevel: 110,
      damage: 330,
      multiplier: { value: 1.5, source: '합성 장비의 대상 스킬 보정' }
    }
  }
}

function skills() {
  return [
    {
      skillId: 'reference',
      selectedLevel: 2,
      effectiveLevel: 2,
      status: 'calculated',
      coefficient: 5,
      effectiveCoefficient: 10,
      panelMultiplier: 7,
      damageMultiplier: 2
    },
    {
      skillId: 'comparison',
      selectedLevel: 3,
      effectiveLevel: 3,
      status: 'calculated',
      coefficient: 10,
      effectiveCoefficient: 20,
      panelMultiplier: 7,
      damageMultiplier: 2
    }
  ]
}

test('기준 실측만 보정에 쓰며 개별 배율은 한 번만 적용한다', () => {
  const input = observations()
  const result = compareSkillDamage({ skills: skills(), ...input })
  assert.equal(result.calibrationScale, 10)
  assert.equal(result.predictedDamage, 300)
  assert.equal(result.comparison.adjustedCoefficient, 30)
  assert.equal(result.coefficientRatio, 3)
  assert.equal(result.residualDamage, -30)
  assert.ok(Math.abs(result.relativeErrorPercent - -100 / 11) < 1e-12)

  input.comparison.damage = 660
  const changed = compareSkillDamage({ skills: skills(), ...input })
  assert.equal(changed.calibrationScale, result.calibrationScale)
  assert.equal(changed.predictedDamage, result.predictedDamage)
  assert.equal(changed.residualDamage, -360)

  const linkedSkills = skills()
  linkedSkills[0].selectedLevel = 1
  const linked = compareSkillDamage({ skills: linkedSkills, ...observations() })
  assert.equal(linked.reference.selectedLevel, 1)
  assert.equal(linked.reference.effectiveLevel, 2)
})

test('다른 측정 환경, 대상 레벨과 같은 스킬의 자기 비교는 거절한다', () => {
  for (const change of [
    (input) => {
      input.comparison.contextId = 'another-session'
    },
    (input) => {
      input.comparison.targetLevel = 120
    }
  ]) {
    const input = observations()
    change(input)
    assert.throws(() => compareSkillDamage({ skills: skills(), ...input }), {
      code: 'MEASUREMENT_CONTEXT_MISMATCH'
    })
  }
  const input = observations()
  input.comparison.skillId = input.reference.skillId
  assert.throws(() => compareSkillDamage({ skills: skills(), ...input }), {
    code: 'INVALID_MEASUREMENT'
  })
})

test('계산 보류, 누락, 레벨 불일치와 유효하지 않은 데미지를 거절한다', () => {
  for (const invalid of [
    [],
    [skills()[0]],
    [skills()[0], { ...skills()[1], status: 'not-modeled' }],
    [skills()[0], { ...skills()[1], effectiveLevel: 1 }],
    [skills()[0], { ...skills()[1], effectiveCoefficient: 0 }]
  ]) {
    assert.throws(() => compareSkillDamage({ skills: invalid, ...observations() }), {
      code: 'SKILL_NOT_CALCULATED'
    })
  }
  for (const invalid of [0, -1, NaN, Infinity]) {
    const input = observations()
    input.reference.damage = invalid
    assert.throws(() => compareSkillDamage({ skills: skills(), ...input }), {
      code: 'INVALID_MEASUREMENT'
    })
  }
  const input = observations()
  input.comparison.multiplier.value = Infinity
  assert.throws(() => compareSkillDamage({ skills: skills(), ...input }), {
    code: 'INVALID_MEASUREMENT'
  })
})

function snapshotScenario() {
  const ids = ['reference', 'comparison', 'passive']
  const snapshot = {
    details: {
      character: { jobId: 'synthetic-job', jobGrowId: 'synthetic-grow' },
      equipment: { equipment: [{ slotId: 'WEAPON', itemTypeDetail: '광검' }] },
      status: { status: [{ name: '힘', value: 1000 }] },
      skillStyle: {
        style: {
          active: [
            { skillId: 'reference', name: '합성 기준', level: 1 },
            { skillId: 'comparison', name: '합성 비교', level: 2 }
          ],
          passive: [{ skillId: 'passive', name: '합성 패시브', level: 7 }],
          evolution: [],
          enhancement: []
        }
      }
    },
    catalog: ids.map((skillId) => ({
      key: { kind: 'skill', jobId: 'synthetic-job', skillId },
      payload: { name: '합성 상세' }
    }))
  }
  let request
  const metadata = {
    skills: ids.map((skillId) => ({
      skillId,
      nameKo: `합성 ${skillId}`,
      maxLevel: 50,
      hasUP: false,
      hasVP: false
    })),
    warnings: []
  }
  const skillPackage = {
    version: '0.0.0-synthetic',
    rules: {
      job: {
        job: 'weapon_master',
        jobId: 'synthetic-job',
        jobGrowId: 'synthetic-grow',
        weapons: [{ value: '광검' }]
      }
    },
    registry: {
      getNeopleRequirements: () => ({ jobId: 'synthetic-job', skillIds: ids }),
      createCalculator: (profile, dataset) => {
        assert.equal(profile, 'weapon_master')
        assert.deepEqual(Object.keys(dataset.skills), ids)

        return {
          getMetadata: () => metadata,
          calculate: (input) => {
            request = input

            const results = [
              ...skills(),
              { skillId: 'passive', selectedLevel: 8, effectiveLevel: 9, status: 'non-damaging' }
            ]

            return { skills: results, warnings: [] }
          }
        }
      }
    }
  }
  const readRequest = () => request

  return { snapshot, skillPackage, readRequest }
}

test('오프라인 선택, 패시브 레벨 보정의 원래 값과 출처를 보존한다', () => {
  const { snapshot, skillPackage, readRequest } = snapshotScenario()
  const before = structuredClone(snapshot)
  const input = observations()
  // Extra user fields must not replace the actual package result.
  input.skills = []
  const summary = calculateSnapshotMeasurement(snapshot, input, skillPackage)
  assert.deepEqual(readRequest(), {
    weapon: '광검',
    levels: { reference: 2, comparison: 3, passive: 8 },
    overrides: {}
  })
  assert.deepEqual(
    summary.levelOverrides.map(({ originalLevel, level, source }) => ({
      originalLevel,
      level,
      source
    })),
    [
      { originalLevel: 1, level: 2, source: '합성 관측' },
      { originalLevel: 2, level: 3, source: '합성 관측' },
      { originalLevel: 7, level: 8, source: '합성 장비 스킬 레벨' }
    ]
  )
  assert.deepEqual(summary.statusValues, [{ name: '힘', snapshotValue: 1000, observedValue: 2000 }])
  assert.equal(summary.levelOverrides[2].effectiveLevel, 9)
  assert.equal(summary.comparison.predictedDamage, 300)
  assert.deepEqual(snapshot, before)
})

test('다른 직업, 필수 상세 누락, 알 수 없는 레벨 보정을 거절한다', () => {
  for (const change of [
    (snapshot) => {
      snapshot.details.character.jobGrowId = 'other-grow'
    },
    (snapshot) => {
      snapshot.catalog.pop()
    }
  ]) {
    const { snapshot, skillPackage } = snapshotScenario()
    change(snapshot)
    assert.throws(() => calculateSnapshotMeasurement(snapshot, observations(), skillPackage), {
      code: 'INVALID_SKILL_SNAPSHOT'
    })
  }
  const { snapshot, skillPackage } = snapshotScenario()
  const input = observations()
  input.levelOverrides[0].skillId = 'unknown'
  assert.throws(() => calculateSnapshotMeasurement(snapshot, input, skillPackage), {
    code: 'INVALID_MEASUREMENT'
  })
})

test('CLI는 잘못된 인자와 파일 읽기 실패에 경로나 원문을 출력하지 않는다', () => {
  const marker = 'synthetic-private-marker'
  for (const args of [
    ['--unexpected', marker],
    [
      '--package-directory',
      `/${marker}`,
      '--snapshot',
      `/${marker}.json`,
      '--observations',
      `/${marker}-observed.json`
    ]
  ]) {
    const result = spawnSync(
      process.execPath,
      [new URL('./verify-skill-measurement.mjs', import.meta.url).pathname, ...args],
      { encoding: 'utf8', env: {} }
    )
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    const body = JSON.parse(result.stderr)
    assert.ok(['INVALID_MEASUREMENT', 'MEASUREMENT_FAILED'].includes(body.error.code))
    assert.equal(result.stderr.includes(marker), false)
    assert.equal(result.stderr.includes('Error:'), false)
  }
})
