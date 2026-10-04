import { readFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { parseCharacterSearchQuery } from '../dist/characters/query.js'
import { CATALOG_LIMITS } from '../dist/characters/catalog/types.js'

const packageName = '@blahaj94/dfragon-skills'
const failureMessages = {
  INVALID_ARGUMENTS: '실행 인자와 절대 패키지 설치 경로를 확인해 주세요.',
  PACKAGE_UNAVAILABLE: '설치된 스킬 패키지와 공개 export를 읽지 못했습니다.',
  CHARACTER_LOOKUP_FAILED: '캐릭터 검색 또는 상세 조회에 실패했습니다.',
  CHARACTER_NOT_UNIQUE: '서버와 이름이 정확히 일치하는 캐릭터가 하나여야 합니다.',
  PROFILE_MISMATCH: '캐릭터 직업 식별자가 선택한 계산 규칙과 다릅니다.',
  INVALID_CHARACTER_DATA: '계산에 필요한 캐릭터 정보가 누락되거나 잘못되었습니다.',
  UNSUPPORTED_WEAPON: '장착 무기가 선택한 계산 규칙에서 지원되지 않습니다.',
  INVALID_SKILL_SELECTION: '스킬 레벨 또는 개화, 강화 선택을 계산 입력으로 변환할 수 없습니다.',
  CATALOG_LOOKUP_FAILED: '계산에 필요한 스킬 상세를 모두 조회하지 못했습니다.',
  CALCULATION_FAILED: '패키지 계산 입력 검증 또는 계산에 실패했습니다.',
  INVALID_SECRET: 'Neople key 입력을 확인해 주세요.',
  VERIFICATION_FAILED: '스킬 계산 검증에 실패했습니다.'
}

export class SkillVerificationFailure extends Error {
  constructor(code) {
    super(failureMessages[code])
    this.code = code
  }
}

export function verificationError(error) {
  const code = error instanceof SkillVerificationFailure ? error.code : 'VERIFICATION_FAILED'
  const message = failureMessages[code]

  return { error: { code, message } }
}

export function parseVerificationArguments(args) {
  try {
    const { values } = parseArgs({
      args,
      options: {
        server: { type: 'string' },
        character: { type: 'string' },
        profile: { type: 'string' },
        'package-directory': { type: 'string' }
      },
      strict: true,
      allowPositionals: false
    })
    const packageDirectory = values['package-directory']
    if (
      values.profile !== 'weapon_master' ||
      !packageDirectory ||
      !isAbsolute(packageDirectory) ||
      !values.server ||
      values.server === 'all' ||
      !values.character
    ) {
      throw new Error()
    }
    const params = new URLSearchParams({
      serverId: values.server,
      characterName: values.character,
      limit: '200'
    })
    const search = parseCharacterSearchQuery(`/characters?${params}`)
    const profile = values.profile

    return { packageDirectory, profile, search }
  } catch {
    throw new SkillVerificationFailure('INVALID_ARGUMENTS')
  }
}

export async function loadSkillPackage(packageDirectory) {
  try {
    if (!isAbsolute(packageDirectory)) {
      throw new Error()
    }
    const packageRoot = await realpath(join(packageDirectory, 'node_modules', packageName))
    const require = createRequire(join(packageDirectory, 'package.json'))
    const resolveExport = async (specifier) => {
      const resolved = await realpath(require.resolve(specifier))
      const path = relative(packageRoot, resolved)
      if (path.startsWith('..') || isAbsolute(path)) {
        throw new Error()
      }

      return pathToFileURL(resolved).href
    }
    const jobsUrl = await resolveExport(`${packageName}/jobs`)
    const rulesUrl = await resolveExport(`${packageName}/rules/jobs/weapon_master.json`)
    const { createCalculatorRegistry } = await import(jobsUrl)
    const { default: rules } = await import(rulesUrl, { with: { type: 'json' } })
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    if (manifest.name !== packageName || typeof manifest.version !== 'string') {
      throw new Error()
    }
    const registry = createCalculatorRegistry([rules])
    const version = manifest.version

    return { registry, rules, version }
  } catch {
    throw new SkillVerificationFailure('PACKAGE_UNAVAILABLE')
  }
}

function validateCharacter(details, job) {
  const { basic } = details
  if (
    !basic ||
    typeof basic.characterName !== 'string' ||
    !basic.characterName.trim() ||
    typeof basic.jobGrowName !== 'string' ||
    !Number.isInteger(basic.level) ||
    basic.level < 1
  ) {
    throw new SkillVerificationFailure('INVALID_CHARACTER_DATA')
  }

  // Only an exact ID match is supported; names do not establish awakening lineage.
  if (!job.jobGrowId || basic.jobId !== job.jobId || basic.jobGrowId !== job.jobGrowId) {
    throw new SkillVerificationFailure('PROFILE_MISMATCH')
  }
  const equipment = details.equipment?.equipment
  if (!Array.isArray(equipment)) {
    throw new SkillVerificationFailure('INVALID_CHARACTER_DATA')
  }
  const weapons = equipment.filter((item) => item?.slotId === 'WEAPON')
  if (weapons.length !== 1) {
    throw new SkillVerificationFailure('INVALID_CHARACTER_DATA')
  }
  const weapon = weapons[0].itemTypeDetail
  if (!job.weapons.some((candidate) => candidate.value === weapon)) {
    throw new SkillVerificationFailure('UNSUPPORTED_WEAPON')
  }

  return weapon
}

export function buildCalculationRequest(details, job, metadata) {
  const weapon = validateCharacter(details, job)
  const style = details.skill_style?.skill?.style

  return buildSkillSelection(style, weapon, metadata)
}

export function buildSkillSelection(style, weapon, metadata) {
  if (
    !style ||
    !Array.isArray(style.active) ||
    !Array.isArray(style.passive) ||
    !Array.isArray(style.evolution) ||
    !Array.isArray(style.enhancement)
  ) {
    throw new SkillVerificationFailure('INVALID_CHARACTER_DATA')
  }
  const known = new Map(metadata.skills.map((skill) => [skill.skillId, skill]))
  const levels = {}
  const overrides = {}
  const excluded = []
  const seen = new Set()
  for (const skill of [...style.active, ...style.passive]) {
    if (
      !skill ||
      typeof skill.skillId !== 'string' ||
      !skill.skillId ||
      typeof skill.name !== 'string' ||
      !Number.isInteger(skill.level) ||
      skill.level < 0 ||
      seen.has(skill.skillId)
    ) {
      throw new SkillVerificationFailure('INVALID_SKILL_SELECTION')
    }
    seen.add(skill.skillId)
    const definition = known.get(skill.skillId)
    if (!definition) {
      excluded.push({ name: skill.name, reason: 'profile-does-not-include-skill' })
      continue
    }

    if (skill.level > definition.maxLevel) {
      throw new SkillVerificationFailure('INVALID_SKILL_SELECTION')
    }
    levels[skill.skillId] = skill.level
  }
  for (const [selections, option, capability] of [
    [style.evolution, 'vp', 'hasVP'],
    [style.enhancement, 'up', 'hasUP']
  ]) {
    const selected = new Set()
    for (const selection of selections) {
      const definition = known.get(selection?.skillId)
      if (
        !definition ||
        !definition[capability] ||
        ![1, 2].includes(selection.type) ||
        !(levels[selection.skillId] > 0) ||
        selected.has(selection.skillId)
      ) {
        throw new SkillVerificationFailure('INVALID_SKILL_SELECTION')
      }
      selected.add(selection.skillId)
      overrides[selection.skillId] ??= {}
      overrides[selection.skillId][option] = selection.type
    }
  }
  const warnings = [
    '장비, 스탯, 대상 방어를 합산한 데미지가 아닌 스킬 계수와 쿨타임 검증입니다.',
    '장비별 스킬 레벨, 스탯, 추가 쿨타임 감소, 특수 무기 보정은 별도로 입력하지 않습니다. API가 보고한 스킬 레벨과 무기 종류만 사용합니다.',
    '모드는 추정하지 않고 패키지의 무기별 기본 모드를 사용합니다.',
    'API 스킬 레벨을 selectedLevel로 전달하고 패키지의 패시브 가산 후 effectiveLevel을 함께 표시합니다.'
  ]
  if (style.chain != null) {
    warnings.push('스킬 체인 선택은 계산 입력에 반영하지 않습니다.')
  }

  if (excluded.length) {
    warnings.push('계산 프로필에 없는 스킬은 excluded 목록에 표시하고 제외했습니다.')
  }
  const request = { weapon, levels, overrides }

  return { request, warnings, excluded }
}

async function fetchRequiredSkills(requirements, fetchCatalog) {
  const ids = [...new Set(requirements.skillIds)]
  if (!ids.length || ids.length > CATALOG_LIMITS.maximumReferencesPerLoad) {
    throw new SkillVerificationFailure('CATALOG_LOOKUP_FAILED')
  }
  const controller = new AbortController()
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)])
  const skills = {}
  let next = 0
  const workers = Array.from(
    { length: Math.min(CATALOG_LIMITS.maximumConcurrentBatches, ids.length) },
    async () => {
      while (next < ids.length) {
        signal.throwIfAborted()
        const skillId = ids[next++]
        const jobId = requirements.jobId
        const key = { kind: 'skill', jobId, skillId }
        const values = await fetchCatalog([key], signal)
        signal.throwIfAborted()
        if (
          values.length !== 1 ||
          values[0].key.skillId !== skillId ||
          values[0].key.jobId !== jobId
        ) {
          throw new Error()
        }
        skills[skillId] = values[0].payload
      }
    }
  )
  try {
    await Promise.all(workers)

    return skills
  } catch {
    controller.abort()
    await Promise.allSettled(workers)
    throw new SkillVerificationFailure('CATALOG_LOOKUP_FAILED')
  }
}

export async function verifyCharacterSkills(options, skillPackage, providers) {
  let details
  try {
    const { rows } = await providers.searchCharacters(options.search)
    const matches = rows.filter(
      (row) =>
        row.serverId === options.search.serverId &&
        row.characterName === options.search.characterName
    )
    if (matches.length !== 1) {
      throw new SkillVerificationFailure('CHARACTER_NOT_UNIQUE')
    }
    const { characterId, serverId } = matches[0]
    details = await providers.fetchDetails({ characterId, serverId }, new AbortController().signal)
    if (details.basic?.characterName !== options.search.characterName) {
      throw new SkillVerificationFailure('INVALID_CHARACTER_DATA')
    }
  } catch (error) {
    if (error instanceof SkillVerificationFailure) {
      throw error
    }
    throw new SkillVerificationFailure('CHARACTER_LOOKUP_FAILED')
  }
  validateCharacter(details, skillPackage.rules.job)
  const requirements = skillPackage.registry.getNeopleRequirements(options.profile)
  const skills = await fetchRequiredSkills(requirements, providers.fetchCatalog)
  let metadata
  let result
  let input
  try {
    const jobId = requirements.jobId
    const calculator = skillPackage.registry.createCalculator(options.profile, { jobId, skills })
    metadata = calculator.getMetadata()
    input = buildCalculationRequest(details, skillPackage.rules.job, metadata)
    result = calculator.calculate(input.request, { explain: true })
  } catch (error) {
    if (error instanceof SkillVerificationFailure) {
      throw error
    }
    throw new SkillVerificationFailure('CALCULATION_FAILED')
  }
  const names = new Map(metadata.skills.map((skill) => [skill.skillId, skill.nameKo]))
  const learned = result.skills.filter((skill) => skill.selectedLevel > 0)
  const calculated = learned.filter((skill) => skill.status === 'calculated')
  const held = learned.filter((skill) => ['not-modeled', 'incomplete-data'].includes(skill.status))
  const counts = {
    calculated: calculated.length,
    held: held.length,
    nonDamaging: learned.filter((skill) => skill.status === 'non-damaging').length,
    unlearned: result.skills.length - learned.length,
    excluded: input.excluded.length
  }
  const selectedSkills = learned.map((skill) => {
    const name = names.get(skill.skillId)
    const {
      selectedLevel,
      effectiveLevel,
      status,
      coefficient,
      effectiveCoefficient,
      cooldown,
      cooldownKind,
      warnings
    } = skill

    return {
      name,
      selectedLevel,
      effectiveLevel,
      status,
      coefficient,
      effectiveCoefficient,
      cooldown,
      cooldownKind,
      warnings
    }
  })
  const { characterName: name, jobGrowName: job, level } = details.basic
  const character = { name, job, level, weapon: input.request.weapon }
  const warnings = [...new Set([...input.warnings, ...metadata.warnings, ...result.warnings])]
  const packageVersion = skillPackage.version
  const profile = options.profile
  const excluded = input.excluded

  return { character, packageVersion, profile, counts, selectedSkills, excluded, warnings }
}
