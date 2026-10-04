import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCalculationRequest,
  parseVerificationArguments,
  verificationError,
  verifyCharacterSkills
} from './skill-calculation.mjs'

const job = {
  jobId: 'fixture-job',
  jobGrowId: 'fixture-grow',
  weapons: [{ value: '광검' }]
}
const metadata = {
  skills: [
    { skillId: 'strike', nameKo: '합성 공격', maxLevel: 60, hasUP: true, hasVP: true },
    { skillId: 'mastery', nameKo: '합성 패시브', maxLevel: 30, hasUP: false, hasVP: false },
    { skillId: 'held', nameKo: '합성 보류', maxLevel: 1, hasUP: false, hasVP: false },
    { skillId: 'unlearned', nameKo: '합성 미습득', maxLevel: 30, hasUP: false, hasVP: false }
  ],
  warnings: ['공통 경고', '메타데이터 경고']
}

function fixture() {
  return {
    basic: {
      characterName: '합성캐릭터',
      jobGrowName: '합성 전직',
      level: 115,
      jobId: job.jobId,
      jobGrowId: job.jobGrowId
    },
    equipment: { equipment: [{ slotId: 'WEAPON', itemTypeDetail: '광검' }] },
    skill_style: {
      skill: {
        style: {
          active: [
            { skillId: 'strike', name: '합성 공격', level: 40 },
            { skillId: 'held', name: '합성 보류', level: 1 },
            { skillId: 'outside', name: '프로필 외 스킬', level: 1 }
          ],
          passive: [{ skillId: 'mastery', name: '합성 패시브', level: 1 }],
          evolution: [{ skillId: 'strike', type: 2 }],
          enhancement: [{ skillId: 'strike', type: 1 }],
          chain: { skills: ['strike', null] }
        }
      }
    }
  }
}

test('API 습득 레벨·개화·강화를 전달하고 프로필 밖 스킬과 기본 모드를 명시한다', () => {
  const { request, warnings, excluded } = buildCalculationRequest(fixture(), job, metadata)
  assert.deepEqual(request, {
    weapon: '광검',
    levels: { strike: 40, held: 1, mastery: 1 },
    overrides: { strike: { vp: 2, up: 1 } }
  })
  assert.deepEqual(excluded, [{ name: '프로필 외 스킬', reason: 'profile-does-not-include-skill' }])
  assert.ok(warnings.some((warning) => warning.includes('기본 모드')))
  assert.ok(warnings.some((warning) => warning.includes('스킬 체인')))
})

test('직업 식별자 불일치와 지원하지 않는 무기는 계산 전에 거절한다', () => {
  for (const field of ['jobId', 'jobGrowId']) {
    const details = fixture()
    details.basic[field] = 'other-job'
    assert.throws(() => buildCalculationRequest(details, job, metadata), {
      code: 'PROFILE_MISMATCH'
    })
  }
  const details = fixture()
  details.equipment.equipment[0].itemTypeDetail = '창'
  assert.throws(() => buildCalculationRequest(details, job, metadata), {
    code: 'UNSUPPORTED_WEAPON'
  })
})

test('필수 스킬 목록 누락과 잘못된 레벨·옵션을 기본값으로 숨기지 않는다', () => {
  for (const field of ['active', 'passive', 'evolution', 'enhancement']) {
    const details = fixture()
    delete details.skill_style.skill.style[field]
    assert.throws(() => buildCalculationRequest(details, job, metadata), {
      code: 'INVALID_CHARACTER_DATA'
    })
  }
  const invalidSelections = [
    (style) => {
      style.active[0].level = 61
    },
    (style) => {
      style.active[0].level = -1
    },
    (style) => {
      style.active.push(style.active[0])
    },
    (style) => {
      style.evolution[0].type = 3
    },
    (style) => {
      style.enhancement[0].skillId = 'mastery'
    },
    (style) => {
      style.evolution[0].skillId = 'outside'
    },
    (style) => {
      style.active[0].level = 0
    }
  ]
  for (const change of invalidSelections) {
    const details = fixture()
    change(details.skill_style.skill.style)
    assert.throws(() => buildCalculationRequest(details, job, metadata), {
      code: 'INVALID_SKILL_SELECTION'
    })
  }
})

function scenario() {
  const ids = ['strike', 'mastery', 'held', 'unlearned', 'external-source']
  const requested = []
  let active = 0
  let maximumActive = 0
  const options = {
    profile: 'weapon_master',
    search: { serverId: 'siroco', characterName: '합성캐릭터', limit: 200 }
  }
  const skillPackage = {
    version: '0.0.0-fixture',
    rules: { job },
    registry: {
      getNeopleRequirements: () => ({ jobId: job.jobId, skillIds: ids }),
      createCalculator: (profile, dataset) => {
        assert.equal(profile, 'weapon_master')
        assert.equal(dataset.jobId, job.jobId)
        assert.deepEqual(Object.keys(dataset.skills).sort(), [...ids].sort())

        return {
          getMetadata: () => metadata,
          calculate: (request, calculationOptions) => {
            assert.equal(request.levels.mastery, 1)
            assert.deepEqual(request.overrides.strike, { vp: 2, up: 1 })
            assert.deepEqual(calculationOptions, { explain: true })

            return {
              skills: [
                {
                  skillId: 'strike',
                  selectedLevel: 40,
                  effectiveLevel: 40,
                  status: 'calculated',
                  coefficient: 100,
                  effectiveCoefficient: 200,
                  cooldown: 8,
                  cooldownKind: 'cast',
                  warnings: []
                },
                {
                  skillId: 'mastery',
                  selectedLevel: 1,
                  effectiveLevel: 22,
                  status: 'non-damaging',
                  coefficient: null,
                  effectiveCoefficient: null,
                  cooldown: null,
                  cooldownKind: 'unknown',
                  warnings: []
                },
                {
                  skillId: 'held',
                  selectedLevel: 1,
                  effectiveLevel: 1,
                  status: 'not-modeled',
                  coefficient: null,
                  effectiveCoefficient: null,
                  cooldown: null,
                  cooldownKind: 'unknown',
                  warnings: ['규칙 보류']
                },
                { skillId: 'unlearned', selectedLevel: 0, status: 'non-damaging' }
              ],
              warnings: ['공통 경고', '결과 경고', '메타데이터 경고']
            }
          }
        }
      }
    }
  }
  const providers = {
    searchCharacters: async () => ({
      rows: [{ serverId: 'siroco', characterId: 'synthetic-id', characterName: '합성캐릭터' }]
    }),
    fetchDetails: async () => fixture(),
    fetchCatalog: async ([key], signal) => {
      assert.equal(signal.aborted, false)
      requested.push(key.skillId)
      active++
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setImmediate(resolve))
      active--

      return [{ key, payload: { name: '합성 스킬 상세' } }]
    }
  }
  const maximumConcurrency = () => maximumActive

  return { options, skillPackage, providers, requested, ids, maximumConcurrency }
}

test('필요한 모든 상세를 최대 세 개씩 조회하고 계산·보류·미습득을 구분한다', async () => {
  const context = scenario()
  const summary = await verifyCharacterSkills(
    context.options,
    context.skillPackage,
    context.providers
  )
  assert.deepEqual(context.requested.sort(), [...context.ids].sort())
  assert.equal(context.maximumConcurrency(), 3)
  assert.deepEqual(summary.counts, {
    calculated: 1,
    held: 1,
    nonDamaging: 1,
    unlearned: 1,
    excluded: 1
  })
  assert.equal(summary.packageVersion, '0.0.0-fixture')
  assert.deepEqual(summary.warnings.slice(-3), ['공통 경고', '메타데이터 경고', '결과 경고'])
  assert.equal(summary.warnings.filter((warning) => warning === '공통 경고').length, 1)
  assert.deepEqual(summary.selectedSkills[0], {
    name: '합성 공격',
    selectedLevel: 40,
    effectiveLevel: 40,
    status: 'calculated',
    coefficient: 100,
    effectiveCoefficient: 200,
    cooldown: 8,
    cooldownKind: 'cast',
    warnings: []
  })
  assert.equal(summary.selectedSkills[1].effectiveLevel, 22)
  assert.equal(JSON.stringify(summary).includes('synthetic-id'), false)
})

test('검색 불일치와 직업 불일치는 스킬 상세 fan-out 전에 중단한다', async () => {
  const context = scenario()
  context.providers.searchCharacters = async () => ({ rows: [] })
  await assert.rejects(
    verifyCharacterSkills(context.options, context.skillPackage, context.providers),
    { code: 'CHARACTER_NOT_UNIQUE' }
  )
  assert.deepEqual(context.requested, [])

  const mismatch = scenario()
  mismatch.providers.fetchDetails = async () => {
    const details = fixture()
    details.basic.jobGrowId = 'wrong-grow'

    return details
  }
  await assert.rejects(
    verifyCharacterSkills(mismatch.options, mismatch.skillPackage, mismatch.providers),
    { code: 'PROFILE_MISMATCH' }
  )
  assert.deepEqual(mismatch.requested, [])
})

test('필수 상세 누락은 실패하며 공급자 원문 오류를 출력하지 않는다', async () => {
  const context = scenario()
  context.providers.fetchCatalog = async () => []
  await assert.rejects(
    verifyCharacterSkills(context.options, context.skillPackage, context.providers),
    { code: 'CATALOG_LOOKUP_FAILED' }
  )
  context.providers.searchCharacters = async () => {
    throw new Error('synthetic-sensitive-marker')
  }
  let result
  try {
    await verifyCharacterSkills(context.options, context.skillPackage, context.providers)
  } catch (error) {
    result = verificationError(error)
  }
  assert.equal(result.error.code, 'CHARACTER_LOOKUP_FAILED')
  assert.equal(JSON.stringify(result).includes('synthetic-sensitive-marker'), false)
  assert.deepEqual(verificationError(new Error('synthetic-sensitive-marker')), {
    error: { code: 'VERIFICATION_FAILED', message: '스킬 계산 검증에 실패했습니다.' }
  })
})

test('명시 서버·지원 프로필·절대 설치 경로를 요구하고 일반 검색 규칙을 재사용한다', () => {
  const args = [
    '--server',
    'siroco',
    '--character',
    '합성캐릭터',
    '--profile',
    'weapon_master',
    '--package-directory',
    '/tmp/fixture-prefix'
  ]
  const parsed = parseVerificationArguments(args)
  assert.deepEqual(parsed.search, { serverId: 'siroco', characterName: '합성캐릭터', limit: 200 })
  for (const [index, value] of [
    [1, 'all'],
    [1, 'unknown'],
    [3, '앞뒤공백 '],
    [5, '../other'],
    [7, './relative']
  ]) {
    const invalid = [...args]
    invalid[index] = value
    assert.throws(() => parseVerificationArguments(invalid), { code: 'INVALID_ARGUMENTS' })
  }
})
